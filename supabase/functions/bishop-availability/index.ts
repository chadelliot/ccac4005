// Public availability check for the invitation form.
//
// Answers one question: is a given date obviously unavailable? It deliberately
// never confirms a booking — a free slot here means "worth submitting", not
// "yes". The Bishop's diary is private, so the response says busy or free and
// never what the conflicting engagement is.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getBusyIntervals, CHURCH_TIMEZONE } from "../_shared/google-calendar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
  });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? "";
    if (!DATE_RE.test(date)) {
      return json({ error: "Provide ?date=YYYY-MM-DD" }, 400);
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: settings } = await db
      .from("bishop_booking_public_settings")
      .select("blocked_weekdays, lead_time_days, accepting_requests")
      .eq("id", 1)
      .maybeSingle();

    const blocked: number[] = settings?.blocked_weekdays ?? [0];
    const leadDays: number = settings?.lead_time_days ?? 30;
    const accepting: boolean = settings?.accepting_requests ?? true;

    if (!accepting) {
      return json({ date, available: false, reason: "closed", message: "The Bishop's calendar is closed to new requests at this time." });
    }

    // Parse as a plain calendar date. `new Date("2026-08-16")` is UTC midnight,
    // which reports the previous day's weekday for anyone west of Greenwich.
    const [y, m, d] = date.split("-").map(Number);
    const local = new Date(y, m - 1, d);
    if (Number.isNaN(local.getTime())) return json({ error: "Invalid date" }, 400);

    if (blocked.includes(local.getDay())) {
      const dayName = local.toLocaleDateString("en-US", { weekday: "long" });
      return json({
        date,
        available: false,
        reason: "blocked_weekday",
        message:
          local.getDay() === 0
            ? "Bishop Marcus is with his own congregation on Sundays. Please choose another day."
            : `${dayName}s are not available for engagements.`,
      });
    }

    const today = new Date();
    const earliest = new Date(today.getFullYear(), today.getMonth(), today.getDate() + leadDays);
    if (local < earliest) {
      return json({
        date,
        available: false,
        reason: "too_soon",
        message: `Invitations need at least ${leadDays} days' notice. Please choose a later date or call the church office.`,
      });
    }

    // Whole day in church local time. Offset is computed rather than hardcoded
    // so this stays correct across the DST boundary.
    const offset = tzOffset(local, CHURCH_TIMEZONE);
    const timeMin = `${date}T00:00:00${offset}`;
    const timeMax = `${date}T23:59:59${offset}`;

    const busy = await getBusyIntervals(timeMin, timeMax);

    if (busy === null) {
      // Credentials absent or Google unreachable. Say so plainly instead of
      // implying the date is open.
      return json({
        date,
        available: null,
        reason: "calendar_unavailable",
        message: "We could not check the Bishop's calendar just now. You are welcome to submit — the office will confirm.",
      });
    }

    if (busy.length > 0) {
      return json({
        date,
        available: false,
        reason: "conflict",
        message: "The Bishop already has an engagement on this date. You may still submit and the office will review.",
      });
    }

    return json({ date, available: true, message: "This date appears open." });
  } catch (err) {
    console.error("bishop-availability failed", err);
    return json({ error: "Availability check failed" }, 500);
  }
});

/** "-04:00" / "-05:00" for the given instant in the given zone. */
function tzOffset(at: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(at).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const diffMinutes = Math.round((asUTC - at.getTime()) / 60000);
  const sign = diffMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(diffMinutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
