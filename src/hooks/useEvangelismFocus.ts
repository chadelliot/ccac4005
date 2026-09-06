import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LatLng = { lat: number; lng: number };

export type FocusTerritory = {
  id: string;
  name: string;
  description: string | null;
  boundary: LatLng[];
};

export type FocusMapZone = {
  id: string;
  name: string;
  description: string | null;
  boundary: LatLng[];
  colour: string;
};

/**
 * Which area the member map should anchor on, and why.
 *
 * "current" is this week's target. "previous" is the last one anyone set —
 * shown rather than nothing, because last week's streets are a far better
 * answer to "where should I go?" than an empty map. "territory" is the standing
 * ground, used when no week has ever been set.
 */
export type FocusSource = "current" | "previous" | "territory";
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
 * Boundaries are fetched — the congregation is shown the shape of the ground
 * they have been given. Coverage counts are not: contact density and
 * per-quadrant soul totals stay with leadership, so this asks the database for
 * outlines and nothing else rather than fetching numbers and hiding them.
 */
export function useEvangelismFocus() {
  const [territory, setTerritory] = useState<FocusTerritory | null>(null);
  const [focus, setFocus] = useState<FocusZone | null>(null);
  const [assignment, setAssignment] = useState<FocusAssignment | null>(null);
  const [zones, setZones] = useState<FocusMapZone[]>([]);
  const [focusSource, setFocusSource] = useState<FocusSource>("territory");
  const [focusWeek, setFocusWeek] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [t, f, sat, z, latest] = await Promise.all([
        supabase
          .from("evangelism_territories")
          .select("id,name,description,boundary")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle(),
        supabase.rpc("current_evangelism_focus"),
        supabase.rpc("next_saturday"),
        supabase
          .from("evangelism_zones")
          .select("id,name,description,boundary,colour")
          .order("sort_order"),
        // The most recent week anyone set, whenever that was. Read directly
        // rather than through the RPC, which only answers for this week.
        supabase
          .from("evangelism_focus")
          .select("zone_id,week_start,note")
          .order("week_start", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!active) return;

      const territoryRow = t.data as
        | (Omit<FocusTerritory, "boundary"> & { boundary: unknown })
        | null;
      setTerritory(
        territoryRow
          ? { ...territoryRow, boundary: (territoryRow.boundary as LatLng[] | null) ?? [] }
          : null,
      );

      setZones(
        (
          (z.data ?? []) as {
            id: string;
            name: string;
            description: string | null;
            boundary: unknown;
            colour: string | null;
          }[]
        )
          .map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            boundary: (row.boundary as LatLng[] | null) ?? [],
            colour: row.colour ?? "#4338ca",
          }))
          .filter((zone) => zone.boundary.length >= 3),
      );

      const current = Array.isArray(f.data) ? ((f.data[0] as FocusZone | undefined) ?? null) : null;
      const previous = latest.data as {
        zone_id: string | null;
        week_start: string;
        note: string | null;
      } | null;

      if (current) {
        setFocus(current);
        setFocusSource("current");
        setFocusWeek(previous?.week_start ?? null);
      } else if (previous?.zone_id) {
        // Fall back to the last established area rather than showing nothing.
        const zoneRow = (z.data ?? []).find((row) => row.id === previous.zone_id) as
          | { id: string; name: string; colour: string | null }
          | undefined;
        setFocus(
          zoneRow
            ? {
                zone_id: zoneRow.id,
                zone_name: zoneRow.name,
                colour: zoneRow.colour,
                note: previous.note,
              }
            : null,
        );
        setFocusSource(zoneRow ? "previous" : "territory");
        setFocusWeek(previous.week_start);
      } else {
        setFocus(null);
        setFocusSource("territory");
        setFocusWeek(null);
      }

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

  return { territory, focus, zones, focusSource, focusWeek, assignment, loading };
}
