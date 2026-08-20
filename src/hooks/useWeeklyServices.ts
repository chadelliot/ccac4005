import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type WeeklyService = {
  id: string;
  title: string;
  description: string | null;
  day_of_week: number;
  start_time: string;
  location: string | null;
  is_virtual: boolean;
  virtual_note: string | null;
  virtual_link: string | null;
  virtual_until: string | null;
};

export type UpcomingService = WeeklyService & {
  /** The next time this service actually meets. */
  nextAt: Date;
  /** Whether the virtual override is in force for that occurrence. */
  virtualNow: boolean;
  /** Stable per-occurrence key, so a dismissal lasts a week rather than forever. */
  occurrenceKey: string;
};

/**
 * The church runs on Eastern time regardless of where a visitor is reading
 * from. "Sunday at 1pm" means 1pm in Baltimore, so the occurrence is built in
 * that zone rather than the browser's — otherwise someone opening the site from
 * California is told the wrong hour.
 */
const CHURCH_TZ = "America/New_York";

/** Offset of `tz` from UTC, in minutes, at the given instant. */
function tzOffsetMinutes(at: Date, tz: string): number {
  // Formatting to a fixed locale and reparsing is the only dependency-free way
  // to ask "what is the wall clock in that zone", and it handles DST correctly.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  );
  return (asUTC - at.getTime()) / 60000;
}

/**
 * The next occurrence of a weekly service, at or after `from`.
 *
 * A service that started within the last two hours still counts as "now" — a
 * visitor checking at ten past one on a Sunday should be told the service is
 * under way, not sent to next week.
 */
export function nextOccurrence(service: WeeklyService, from: Date = new Date()): Date {
  const [h, m] = service.start_time.split(":").map(Number);
  const GRACE_MS = 2 * 3600_000;

  for (let addDays = 0; addDays <= 7; addDays++) {
    const probe = new Date(from.getTime() + addDays * 86400_000);
    // The date as it reads in Baltimore, which is what the day_of_week means.
    const local = new Intl.DateTimeFormat("en-CA", {
      timeZone: CHURCH_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }).formatToParts(probe);
    const pick = (t: string) => local.find((p) => p.type === t)?.value ?? "";
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(pick("weekday"));
    if (dow !== service.day_of_week) continue;

    // Build the instant for that wall-clock time in the church's zone.
    const guess = Date.UTC(Number(pick("year")), Number(pick("month")) - 1, Number(pick("day")), h, m);
    const offset = tzOffsetMinutes(new Date(guess), CHURCH_TZ);
    const at = new Date(guess - offset * 60000);

    if (at.getTime() + GRACE_MS >= from.getTime()) return at;
  }
  // Unreachable for a valid day_of_week; keeps the return type honest.
  return new Date(from.getTime() + 7 * 86400_000);
}

export function useWeeklyServices() {
  const [services, setServices] = useState<WeeklyService[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("weekly_services")
        .select("id,title,description,day_of_week,start_time,location,is_virtual,virtual_note,virtual_link,virtual_until")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (active) setServices((data as WeeklyService[] | null) ?? []);
    })();
    return () => {
      active = false;
    };
  }, []);

  const upcoming = useMemo<UpcomingService[]>(() => {
    if (!services) return [];
    const now = new Date();
    return services
      .map((s) => {
        const nextAt = nextOccurrence(s, now);
        return {
          ...s,
          nextAt,
          // The override applies only while it has not lapsed, so a forgotten
          // toggle stops mattering on its own.
          virtualNow:
            s.is_virtual && (!s.virtual_until || new Date(s.virtual_until).getTime() > now.getTime()),
          occurrenceKey: `${s.id}:${nextAt.toISOString().slice(0, 10)}`,
        };
      })
      .sort((a, b) => a.nextAt.getTime() - b.nextAt.getTime());
  }, [services]);

  return { services, upcoming, loading: services === null };
}
