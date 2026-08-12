// Edge function: geocode a free-text address for the evangelism map.
// Replaces the unauthenticated `geocodeAddress` server function — every caller
// must present a valid Supabase session, so the Maps quota can't be drained by
// anonymous traffic.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

type Component = { long_name: string; short_name: string; types: string[] };

function findComponent(components: Component[], type: string): string | null {
  const c = components.find((cc) => cc.types.includes(type));
  return c ? c.long_name : null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require a signed-in caller.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Not authenticated" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ ok: false, error: "Not authenticated" }, 401);

    const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY");
    if (!apiKey) return json({ ok: false, error: "Geocoding not configured" }, 500);

    const { query } = await req.json();
    if (typeof query !== "string") {
      return json({ ok: false, error: "query must be a string" }, 400);
    }
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed.length > 300) {
      return json({ ok: false, error: "query must be 2-300 characters" }, 400);
    }

    const url = `${GEOCODE_URL}?address=${encodeURIComponent(trimmed)}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return json({ ok: false, error: `Geocoding failed (${res.status})` });

    const body = await res.json() as {
      status: string;
      results?: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
        address_components: Component[];
      }>;
    };
    if (body.status !== "OK" || !body.results?.length) {
      return json({ ok: false, error: body.status || "No results" });
    }

    const r = body.results[0];
    const comps = r.address_components;
    return json({
      ok: true,
      latitude: r.geometry.location.lat,
      longitude: r.geometry.location.lng,
      city:
        findComponent(comps, "locality") ||
        findComponent(comps, "postal_town") ||
        findComponent(comps, "sublocality") ||
        findComponent(comps, "administrative_area_level_2"),
      region: findComponent(comps, "administrative_area_level_1"),
      country: findComponent(comps, "country"),
      formatted: r.formatted_address,
    });
  } catch (e) {
    console.error("geocode-address error:", e);
    return json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});
