import { supabase } from "@/integrations/supabase/client";

export type GeocodeResult = {
  ok: boolean;
  latitude?: number;
  longitude?: number;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  formatted?: string | null;
  error?: string;
};

/**
 * Geocode a free-text address via the `geocode-address` edge function.
 *
 * Keeps the `{ data: { query } }` argument shape of the server function it
 * replaced so call sites read the same. The edge function requires a signed-in
 * caller; `functions.invoke` attaches the session token automatically.
 */
export async function geocodeAddress({
  data,
}: {
  data: { query: string };
}): Promise<GeocodeResult> {
  const query = data.query.trim();
  if (query.length < 2 || query.length > 300) {
    return { ok: false, error: "Address must be 2-300 characters" };
  }

  const { data: result, error } = await supabase.functions.invoke<GeocodeResult>(
    "geocode-address",
    { body: { query } },
  );

  if (error) return { ok: false, error: error.message };
  return result ?? { ok: false, error: "No response from geocoder" };
}
