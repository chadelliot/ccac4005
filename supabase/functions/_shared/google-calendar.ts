/**
 * Google Calendar access for the Bishop's engagement diary.
 *
 * Uses an installed-app OAuth refresh token rather than a service account.
 * A service account cannot see a personal @gmail calendar without domain-wide
 * delegation, which needs Google Workspace — see GOOGLE_SETUP.md.
 *
 * Every export degrades rather than throws when credentials are absent, so the
 * desk stays usable before the church has finished the Google Cloud steps.
 */

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/** Engagements are booked in church local time regardless of the viewer. */
export const CHURCH_TIMEZONE = "America/New_York";

export function calendarConfigured(): boolean {
  return Boolean(
    Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") &&
      Deno.env.get("GOOGLE_CALENDAR_SECRET") &&
      Deno.env.get("GOOGLE_CALENDAR_REFRESH_TOKEN"),
  );
}

export function missingCalendarSecrets(): string[] {
  return [
    "GOOGLE_CALENDAR_CLIENT_ID",
    "GOOGLE_CALENDAR_SECRET",
    "GOOGLE_CALENDAR_REFRESH_TOKEN",
    "GOOGLE_CALENDAR_ID",
  ].filter((k) => !Deno.env.get(k));
}

export function calendarId(override?: string | null): string {
  return (override || "").trim() || Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";
}

// Access tokens last an hour. Edge function instances are reused across
// invocations, so caching here saves a token round-trip on most calls.
let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const client_id = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
  const client_secret = Deno.env.get("GOOGLE_CALENDAR_SECRET");
  const refresh_token = Deno.env.get("GOOGLE_CALENDAR_REFRESH_TOKEN");
  if (!client_id || !client_secret || !refresh_token) {
    throw new Error("calendar_not_configured");
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: "refresh_token" }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("calendar: token refresh failed", res.status, body);
    // A revoked or expired refresh token is the common cause and needs a human
    // to re-run the consent flow, so it is worth distinguishing.
    throw new Error(res.status === 400 ? "calendar_refresh_token_invalid" : "calendar_token_failed");
  }

  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

export type BusyInterval = { start: string; end: string };

/**
 * FreeBusy for a date range. Returns null when the calendar is not configured,
 * which the availability endpoint reports as "unknown" rather than "free" —
 * telling a church a date is open when we cannot actually see the diary is the
 * one answer worse than no answer.
 */
export async function getBusyIntervals(
  timeMin: string,
  timeMax: string,
  id?: string | null,
): Promise<BusyInterval[] | null> {
  if (!calendarConfigured()) return null;

  const token = await getAccessToken();
  const res = await fetch(`${CALENDAR_API}/freeBusy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: CHURCH_TIMEZONE,
      items: [{ id: calendarId(id) }],
    }),
  });

  if (!res.ok) {
    console.error("calendar: freeBusy failed", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const cal = data?.calendars?.[calendarId(id)];
  if (cal?.errors?.length) {
    console.error("calendar: freeBusy returned errors", JSON.stringify(cal.errors));
    return null;
  }
  return (cal?.busy ?? []) as BusyInterval[];
}

export type CreatedEvent = { id: string; htmlLink?: string };

export async function createEvent(opts: {
  summary: string;
  description?: string;
  location?: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** HH:MM, church local */
  startTime: string;
  endDate?: string | null;
  durationHours?: number;
  calendarId?: string | null;
}): Promise<CreatedEvent> {
  const token = await getAccessToken();

  const start = `${opts.startDate}T${opts.startTime}:00`;
  const end = (() => {
    if (opts.endDate && opts.endDate !== opts.startDate) {
      // Multi-day engagement: end on the closing date at the same hour.
      return `${opts.endDate}T${opts.startTime}:00`;
    }
    const [h, m] = opts.startTime.split(":").map(Number);
    const total = h * 60 + m + Math.round((opts.durationHours ?? 2) * 60);
    // Clamp instead of rolling into the next day — a late service that would
    // spill past midnight should end at 23:59 rather than silently move dates.
    const clamped = Math.min(total, 23 * 60 + 59);
    const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
    const mm = String(clamped % 60).padStart(2, "0");
    return `${opts.startDate}T${hh}:${mm}:00`;
  })();

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId(opts.calendarId))}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: opts.summary,
        description: opts.description,
        location: opts.location,
        start: { dateTime: start, timeZone: CHURCH_TIMEZONE },
        end: { dateTime: end, timeZone: CHURCH_TIMEZONE },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    console.error("calendar: event insert failed", res.status, body);
    throw new Error("calendar_insert_failed");
  }

  const data = await res.json();
  return { id: data.id, htmlLink: data.htmlLink };
}
