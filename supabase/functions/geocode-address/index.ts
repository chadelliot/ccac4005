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

    const payload = await req.json();

    // Reverse mode: a dropped map pin naming its own street.
    //
    // Plotting a Saturday route means clicking street corners, and a list of
    // raw coordinates is unusable to someone standing on one. Asking Google
    // what is at the point turns "39.338289, -76.607443" into "4005 Old York
    // Rd" — the difference between a plan a team can follow and a column of
    // numbers.
    if (typeof payload?.lat === "number" && typeof payload?.lng === "number") {
      const { lat, lng } = payload;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return json({ ok: false, error: "lat/lng out of range" }, 400);
      }
      const revUrl = `${GEOCODE_URL}?latlng=${lat},${lng}&key=${apiKey}`;
      const revRes = await fetch(revUrl);
      if (!revRes.ok) return json({ ok: false, error: `Reverse geocoding failed (${revRes.status})` });
      const revData = await revRes.json();
      if (revData.status !== "OK" || !revData.results?.length) {
        return json({ ok: false, error: revData.status ?? "No result" });
      }
      // Prefer an intersection, then a street address, then whatever came
      // first. An intersection is what "the corner of" actually means.
      const results = revData.results as { formatted_address: string; types: string[] }[];
      const byType = (t: string) => results.find((r) => r.types.includes(t));
      const pick =
        byType("intersection") ?? byType("street_address") ?? byType("route") ?? results[0];
      // Trim the city/state/country tail; the team knows what city they are in
      // and the full string does not fit a map label.
      const label = String(pick.formatted_address).split(",").slice(0, 2).join(",").trim();
      return json({ ok: true, label, formatted: pick.formatted_address });
    }

    const { query } = payload;
    if (typeof query !== "string") {
      return json({ ok: false, error: "query must be a string, or send lat/lng to reverse geocode" }, 400);
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
