/**
 * Phone numbers for `tel:` and `sms:` links.
 *
 * The harvest list holds numbers in every shape a person types one — "443-418-0930",
 * "(667) 203-4104", "1 (443) 478-6940", "443 813 4463". Dialling any of those
 * literally is unreliable, so links get a normalised form while the screen keeps
 * showing exactly what was entered. Nobody should see their own record rewritten
 * because software preferred a different punctuation.
 */

/**
 * A number safe to put after `tel:` or `sms:`, or null if it does not look like
 * one. Returning null rather than a best guess is deliberate: a Call button that
 * dials the wrong person is worse than no Call button.
 */
export function toDialable(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  // Keep a leading + if the number was written in international form.
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 0) return null;

  if (plus) {
    // Already international; trust it if it is a plausible length.
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  // North American numbers, which is everything in this list.
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  // Anything else — an extension, a note in the field, a partial number — is
  // left alone rather than padded into something that might dial.
  return null;
}

/** Whether this number can be called or texted at all. */
export function isDialable(raw: string | null | undefined): boolean {
  return toDialable(raw) !== null;
}

export function telHref(raw: string | null | undefined): string | null {
  const n = toDialable(raw);
  return n ? `tel:${n}` : null;
}

/**
 * An `sms:` link, optionally carrying a message body.
 *
 * The body is an enhancement, never the mechanism. iOS honours the body
 * parameter inconsistently — it depends on iOS version, on whether the link is
 * a direct user gesture, and on the separator, which Apple documents as `&`
 * but which historically needed `;` on some versions. Callers that need the
 * text to arrive must copy it to the clipboard first and treat anything that
 * prefills as a bonus.
 */
export function smsHref(raw: string | null | undefined, body?: string): string | null {
  const n = toDialable(raw);
  if (!n) return null;
  if (!body) return `sms:${n}`;
  return `sms:${n}?&body=${encodeURIComponent(body)}`;
}

/**
 * Copy text, with a fallback for browsers that refuse the async clipboard.
 *
 * Safari only grants clipboard access inside a user gesture, and older versions
 * reject navigator.clipboard on non-secure origins entirely. The textarea path
 * is ugly but it is what keeps the invite flow working on the phones this is
 * built for.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
