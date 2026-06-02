import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  query: z.string().trim().min(2).max(300),
});

type GeocodeResult = {
  ok: boolean;
  latitude?: number;
  longitude?: number;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  formatted?: string | null;
  error?: string;
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function findComponent(
  components: Array<{ long_name: string; short_name: string; types: string[] }>,
  type: string,
): string | null {
  const c = components.find((cc) => cc.types.includes(type));
  return c ? c.long_name : null;
}

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<GeocodeResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || !connKey) {
      return { ok: false, error: "Google Maps connector not configured" };
    }

    try {
      const url = `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(data.query)}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Connection-Api-Key": connKey,
        },
      });
      if (!res.ok) {
        return { ok: false, error: `Geocoding failed (${res.status})` };
      }
      const body = (await res.json()) as {
        status: string;
        results?: Array<{
          formatted_address: string;
          geometry: { location: { lat: number; lng: number } };
          address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
        }>;
      };
      if (body.status !== "OK" || !body.results?.length) {
        return { ok: false, error: body.status || "No results" };
      }
      const r = body.results[0];
      const comps = r.address_components;
      return {
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
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
  });
