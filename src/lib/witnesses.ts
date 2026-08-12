import { supabase } from "@/integrations/supabase/client";

export type Witness = { id: string; name: string; linked_user_id: string | null };

export async function listWitnesses(): Promise<Witness[]> {
  const { data } = await supabase
    .from("witnesses")
    .select("id, name, linked_user_id")
    .order("name");
  return (data ?? []) as Witness[];
}

/**
 * Turn a typed name into a witness id, reusing the existing record when the
 * name already exists in any casing.
 *
 * `witnesses` has a unique index on lower(name), which is what keeps
 * "Evg Bri" and "Evg. Bri" from becoming two people. That also means a
 * concurrent insert can lose the race, so a failed insert re-reads rather than
 * surfacing an error.
 */
export async function resolveWitnessId(rawName: string): Promise<string | null> {
  const name = rawName.trim();
  if (!name) return null;

  const existing = await supabase
    .from("witnesses")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existing.data?.id) return existing.data.id;

  const created = await supabase
    .from("witnesses")
    .insert({ name })
    .select("id")
    .single();
  if (created.data?.id) return created.data.id;

  // Lost a race against another insert of the same name — read it back.
  const retry = await supabase
    .from("witnesses")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  return retry.data?.id ?? null;
}

/**
 * Splits "Evg Bri/Brittny" into a primary witness and a co-witness. First name
 * listed takes the credit; the rest is kept alongside so nobody's work is lost.
 */
export function splitWitnessNames(raw: string): {
  primary: string;
  coWitness: string | null;
} {
  const parts = raw
    .split(/[/,&]| and /i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return { primary: raw.trim(), coWitness: null };
  return { primary: parts[0], coWitness: parts.slice(1).join(", ") };
}
