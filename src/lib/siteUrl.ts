const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL as
  | string
  | undefined;

/**
 * Absolute URL for links that leave the app and come back — chiefly Supabase
 * auth emails.
 *
 * Inside the Capacitor WebView `window.location.origin` is `https://localhost`,
 * which a mail client can't resolve, so the confirmation link would dead-end.
 * Point those at the public site via VITE_PUBLIC_SITE_URL; an Android App Link
 * can then hand off to the installed app.
 */
export function siteUrl(path = "/"): string {
  const base =
    PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/$/, "")}${path}`;
}
