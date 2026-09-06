import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Explain a confirmation link that didn't work.
 *
 * Supabase sends auth failures to the project's Site URL with the reason in the
 * URL fragment — `#error=access_denied&error_code=otp_expired&...`. Nothing
 * renders a fragment, so without this someone who clicks a stale link lands on
 * the homepage as though they had typed the address, with no idea their
 * confirmation failed or what to do instead.
 *
 * The commonest cause is not the person doing anything wrong: an email scanner
 * follows the link before they do, spends the single-use token, and their click
 * arrives second. Telling them "expired" alone would invite them to wait for a
 * link that will never work, so the message points at signing in — by then the
 * account is usually already confirmed, because verification happens on the
 * scanner's request too.
 */
const MESSAGES: Record<string, { title: string; body: string }> = {
  otp_expired: {
    title: "That confirmation link has already been used or expired",
    body: "Your email may already be confirmed — try signing in. If that fails, sign up again to get a fresh link.",
  },
  access_denied: {
    title: "That link didn't work",
    body: "It may have expired or already been used. Try signing in, or request a new link.",
  },
};

export function useAuthLinkError() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Supabase uses the fragment; some flows use the query string. Read both
    // rather than guessing which one this error arrived in.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const code = hash.get("error_code") ?? query.get("error_code");
    const error = hash.get("error") ?? query.get("error");
    if (!code && !error) return;

    const known = (code && MESSAGES[code]) || (error && MESSAGES[error]) || null;
    const description = hash.get("error_description") ?? query.get("error_description");

    toast.error(known?.title ?? "That link didn't work", {
      description: known?.body ?? description?.replace(/\+/g, " ") ?? undefined,
      duration: 12_000,
    });

    // Clear it so a refresh doesn't replay the message, and so the address bar
    // stops carrying an error the person has already been told about.
    const clean = window.location.pathname + window.location.search.replace(/[?&]error[^&]*/g, "");
    window.history.replaceState({}, "", clean || "/");
  }, []);
}
