import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FocusTerritory = { id: string; name: string; description: string | null };
export type FocusZone = {
  zone_id: string;
  zone_name: string;
  colour: string | null;
  note: string | null;
};
export type FocusAssignment = {
  assignment_date: string;
  zone_name: string | null;
  meet_at: string | null;
  note: string | null;
  /** Count only — the stop coordinates are leadership's, not the congregation's. */
  stop_count: number;
};

/**
 * The week's focus and Saturday assignment, without anything leadership-only.
 *
 * Shared by the member briefing and the management panel so the two can never
 * disagree about what this week's focus is, and so the same queries are not
 * written twice.
 *
 * Deliberately does NOT fetch zone boundaries or coverage counts. Those are
 * fetched by the management panel alone, so an ordinary member's browser never
 * receives contact density or per-quadrant totals — gating the query rather
 * than hiding the rendered output.
 */
export function useEvangelismFocus() {
  const [territory, setTerritory] = useState<FocusTerritory | null>(null);
  const [focus, setFocus] = useState<FocusZone | null>(null);
  const [assignment, setAssignment] = useState<FocusAssignment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [t, f, sat] = await Promise.all([
        supabase
          .from("evangelism_territories")
          .select("id,name,description")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle(),
        supabase.rpc("current_evangelism_focus"),
        supabase.rpc("next_saturday"),
      ]);
      if (!active) return;

      setTerritory((t.data as FocusTerritory | null) ?? null);
      setFocus(Array.isArray(f.data) ? ((f.data[0] as FocusZone | undefined) ?? null) : null);

      const satDate = sat.data as string | null;
      if (satDate) {
        const { data } = await supabase.rpc("evangelism_assignment_for", { _on: satDate });
        if (!active) return;
        const row = Array.isArray(data)
          ? (data[0] as
              | {
                  assignment_date: string;
                  zone_name: string | null;
                  meet_at: string | null;
                  note: string | null;
                  points: unknown;
                }
              | undefined)
          : undefined;
        setAssignment(
          row
            ? {
                assignment_date: row.assignment_date,
                zone_name: row.zone_name,
                meet_at: row.meet_at,
                note: row.note,
                stop_count: Array.isArray(row.points) ? row.points.length : 0,
              }
            : null,
        );
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { territory, focus, assignment, loading };
}
