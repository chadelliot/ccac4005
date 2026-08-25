import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Target, MapPin, ArrowRight, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Focus = { zone_id: string; zone_name: string; colour: string; note: string | null };
type Assignment = {
  assignment_date: string;
  zone_name: string | null;
  meet_at: string | null;
  note: string | null;
  points: { lat: number; lng: number; label?: string | null }[];
};

/**
 * This week's evangelism target, on the member dashboard.
 *
 * Sits on the overview so it is the first thing a member sees after signing
 * in — the church asked for evangelism to stay at the top of everyone's mind,
 * and a map two clicks away does not do that.
 *
 * Shows the week's zone and Saturday's stops but no contacts, so it is safe for
 * every member: zone names and street corners carry no personal information.
 */
export function EvangelismThisWeek() {
  const [focus, setFocus] = useState<Focus | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [f, sat] = await Promise.all([
        supabase.rpc("current_evangelism_focus"),
        supabase.rpc("next_saturday"),
      ]);
      if (!active) return;
      setFocus(Array.isArray(f.data) ? ((f.data[0] as Focus | undefined) ?? null) : null);

      const satDate = sat.data as string | null;
      if (satDate) {
        const { data } = await supabase.rpc("evangelism_assignment_for", { _on: satDate });
        if (active) {
          // Via unknown: the generated type has `points` as Json, which does not
          // overlap the stop array this actually returns.
          const row = Array.isArray(data) ? (data[0] as unknown as Assignment | undefined) : undefined;
          setAssignment(row ?? null);
        }
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Nothing set yet is not worth a card telling everyone nothing is set.
  if (!ready || (!focus && !assignment)) return null;

  const stopCount = assignment?.points?.length ?? 0;
  const accent = focus?.colour ?? "var(--royal)";

  return (
    <Link
      to="/dashboard/evangelism"
      className="group block border-l-4 border border-border bg-card p-6 transition-colors hover:border-foreground/30"
      style={{ borderLeftColor: accent }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow mb-2 flex items-center gap-1.5" style={{ color: accent }}>
            <Target className="h-3.5 w-3.5" />— Evangelism this week
          </div>

          {focus ? (
            <>
              <div className="font-display text-2xl leading-tight">{focus.zone_name}</div>
              <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
                {focus.note ?? "Our focus area this week — pray over these streets."}
              </p>
            </>
          ) : (
            <div className="font-display text-2xl leading-tight">
              {assignment?.zone_name ?? "Saturday outreach"}
            </div>
          )}

          {assignment && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" />
                {new Date(assignment.assignment_date + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              {stopCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" />
                  {stopCount} {stopCount === 1 ? "stop" : "stops"}
                </span>
              )}
              {assignment.meet_at && <span>Meeting at {assignment.meet_at}</span>}
            </div>
          )}
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 eyebrow text-[10px] text-muted-foreground group-hover:text-foreground">
          See the map
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
