import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * The generated `Database` type has no knowledge of the `bishop_booking_*`
 * tables, because `supabase gen types` cannot be run until the migration in
 * this branch has actually been applied to a database.
 *
 * Casting once here confines that gap to a single line rather than scattering
 * `as any` through every query. Row shapes are still fully typed — see the
 * exported types in `bishopBooking.ts`, which the call sites annotate with — so
 * what is unchecked is the table and column *names*, not the data.
 *
 * TODO(after `supabase db push`): run
 *   supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts
 * then delete this module and import `supabase` directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const bishopDb = supabase as unknown as SupabaseClient<any, "public", any>;

/** Where the public form and the desk send their function calls. */
export function functionsBase(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return url ? `${url.replace(/\/$/, "")}/functions/v1` : "";
}

export function anonKey(): string {
  return (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "";
}
