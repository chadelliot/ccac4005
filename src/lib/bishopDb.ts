/**
 * Helpers for reaching the Bishop's booking edge functions from the browser.
 *
 * This module used to also export a loosely-typed `bishopDb` client, because
 * `supabase gen types` could not run until the migration existed on a real
 * database. The migration is applied and the types regenerated, so callers now
 * import `supabase` directly and everything is fully typed.
 */

/** Base URL for the booking edge functions. */
export function functionsBase(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return url ? `${url.replace(/\/$/, "")}/functions/v1` : "";
}

export function anonKey(): string {
  return (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "";
}
