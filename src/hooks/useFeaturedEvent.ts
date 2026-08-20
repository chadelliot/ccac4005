import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FeaturedEvent = {
  id: string;
  title: string;
  start_at: string;
};

/**
 * The soonest upcoming featured event, or null.
 *
 * Deliberately returns one row rather than a list: the homepage bar is a
 * single strip and the events page shows a single countdown, so resolving
 * "which one" here keeps that decision in one place instead of leaving each
 * consumer to sort and slice.
 *
 * Reads through the public events policy — approved, public, and still in the
 * future — so an unauthenticated visitor gets exactly what a member does.
 */
export function useFeaturedEvent() {
  const [event, setEvent] = useState<FeaturedEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("id,title,start_at")
        .eq("is_featured", true)
        .eq("status", "approved")
        .eq("is_public", true)
        // An event that started earlier today is still worth showing until it
        // is properly past, which is why this is not simply now().
        .gte("start_at", new Date(Date.now() - 6 * 3600_000).toISOString())
        .order("start_at", { ascending: true })
        .limit(1);
      if (!active) return;
      setEvent((data?.[0] as FeaturedEvent | undefined) ?? null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { event, loading };
}

export type Remaining = { days: number; hours: number; minutes: number; seconds: number; past: boolean };

/** Whole units remaining until `iso`. Never returns negatives. */
export function remainingUntil(iso: string, from: number = Date.now()): Remaining {
  const ms = new Date(iso).getTime() - from;
  if (!Number.isFinite(ms) || ms <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true };
  }
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    past: false,
  };
}

/**
 * A ticking `Remaining`.
 *
 * The caller states its own tick rate, because only the caller knows which
 * units it renders. This used to derive the interval from how far away the
 * event was — dropping to 60s beyond a day out — which was wrong the moment a
 * consumer displayed seconds: the digits sat frozen for a minute at a time and
 * the counter looked broken on first paint. A component showing seconds must
 * ask for 1000ms; one showing only days and hours can pass 60_000 and spare
 * every visitor 59 needless re-renders a minute.
 */
export function useCountdown(iso: string | undefined, tickMs: number = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [iso, tickMs]);

  return iso ? remainingUntil(iso, now) : null;
}
