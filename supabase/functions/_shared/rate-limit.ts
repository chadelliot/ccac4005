import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Rate limiting for the public invitation form.
 *
 * The raw client IP is never stored. It is hashed with a server-side salt, so
 * the table can answer "has this source submitted five times in an hour" without
 * holding a log of who visited the church's website.
 */

const WINDOW_MINUTES = 60;
const MAX_PER_WINDOW = 5;
/** A single source hammering one inbox is the more common abuse shape. */
const MAX_PER_EMAIL_PER_DAY = 3;

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

export function clientIp(req: Request): string {
  // Supabase sits behind a proxy, so the socket address is useless here.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

export async function hashIp(ip: string): Promise<string> {
  // Without a salt these are trivially reversible — the IPv4 space is small
  // enough to brute-force a bare SHA-256 in seconds.
  const salt = Deno.env.get("RATE_LIMIT_SALT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type RateLimitResult = { allowed: boolean; reason?: string };

export async function checkAndRecord(req: Request, email: string): Promise<RateLimitResult> {
  const db = serviceClient();
  const ip_hash = await hashIp(clientIp(req));

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count: ipCount, error: ipErr } = await db
    .from("bishop_booking_rate_limit")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ip_hash)
    .gte("created_at", since);

  // Fail open on infrastructure errors. A rate limiter that goes down must not
  // take the invitation form down with it; the honeypot and the desk review
  // are still in front of anything reaching the Bishop.
  if (ipErr) {
    console.error("rate-limit: ip lookup failed", ipErr.message);
    return { allowed: true };
  }

  if ((ipCount ?? 0) >= MAX_PER_WINDOW) {
    return {
      allowed: false,
      reason: "We have received several requests from this connection recently. Please try again in an hour, or call the church office.",
    };
  }

  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count: emailCount } = await db
    .from("bishop_booking_rate_limit")
    .select("id", { count: "exact", head: true })
    .eq("email", email.toLowerCase())
    .gte("created_at", dayAgo);

  if ((emailCount ?? 0) >= MAX_PER_EMAIL_PER_DAY) {
    return {
      allowed: false,
      reason: "This email address has already submitted several requests today. Please contact the church office if you need to make a change.",
    };
  }

  await db.from("bishop_booking_rate_limit").insert({ ip_hash, email: email.toLowerCase() });
  return { allowed: true };
}

export { serviceClient };
