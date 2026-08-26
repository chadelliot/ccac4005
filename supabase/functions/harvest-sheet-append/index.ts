// Append a contact added on the site to the HARVEST LIST 2026 sheet.
//
// The write happens through an Apps Script web app bound to the sheet (see
// docs/harvest-sheet-sync.gs), which runs as the sheet's owner. That avoids a
// service account, a key file, and a Google Cloud project for what is one
// appended row — and the church can read the script that touches their sheet.
//
// The webhook URL and secret stay here rather than in the browser bundle: a
// public endpoint that appends rows to the harvest list should not be
// discoverable by reading the page source.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Not authenticated" }, 401);

    const asCaller = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await asCaller.auth.getUser();
    if (authError || !user) return json({ ok: false, error: "Not authenticated" }, 401);

    const webhook = Deno.env.get("HARVEST_SHEET_WEBHOOK");
    const secret = Deno.env.get("HARVEST_SHEET_SECRET");
    if (!webhook || !secret) {
      // Not configured is not an error the person adding a contact caused, and
      // their contact is already saved — say so plainly rather than failing.
      return json({ ok: false, configured: false, error: "Sheet sync is not set up yet." });
    }

    const c = await req.json();
    if (!c?.name || !c?.met_on) {
      return json({ ok: false, error: "name and met_on are required" }, 400);
    }

    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        met_on: c.met_on,
        witness: c.witness ?? "",
        where_met: c.where_met ?? "",
        name: c.name,
        phone: c.phone ?? "",
        notes: c.notes ?? "",
        gender: c.gender ?? "",
      }),
      // Apps Script answers a deployment URL with a redirect to its runtime.
      redirect: "follow",
    });

    const text = await res.text();
    let parsed: { ok?: boolean; tab?: string; row?: number; created?: boolean; error?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      // A login page instead of JSON means the deployment is not set to
      // "Anyone" — worth saying, since it is the one setting people miss.
      return json({
        ok: false,
        error: "The sheet did not answer with JSON. Check the web app is deployed with access set to Anyone.",
      });
    }

    if (!parsed.ok) return json({ ok: false, error: parsed.error ?? "The sheet refused the row." });
    return json({ ok: true, tab: parsed.tab, row: parsed.row, created: parsed.created });
  } catch (e) {
    console.error("harvest-sheet-append error:", e);
    return json({ ok: false, error: "Could not reach the sheet." }, 500);
  }
});
