import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Target, MapPin, Loader2, Users, Plus, X, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useCapabilities } from "@/lib/adminCapabilities";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { TerritoryMap, type LatLng, type Zone, type StopPoint } from "./TerritoryMap";

type TerritoryRow = { id: string; name: string; description: string | null; boundary: LatLng[] };
type ZoneRow = {
  id: string;
  name: string;
  description: string | null;
  boundary: LatLng[];
  colour: string;
  sort_order: number;
};
type Coverage = {
  zone_id: string;
  contacts: number;
  gospel_shared: number;
  visited: number;
  baptized: number;
  holy_ghost: number;
};
type Focus = { zone_id: string; zone_name: string; note: string | null; week_start: string };
type Assignment = {
  id: string;
  assignment_date: string;
  zone_id: string | null;
  zone_name: string | null;
  note: string | null;
  meet_at: string | null;
  points: StopPoint[];
};

/**
 * The territory, its quadrants, and this week's target.
 *
 * Visible to every signed-in member, which is the whole point — the map is how
 * the congregation sees the ground it has been given. It shows boundaries and
 * counts only; the contacts themselves stay on the leadership map behind
 * evangelism_management, because they are the personal details of people who
 * never signed up for this site.
 */
export function TerritoryPanel() {
  const { user } = useSession();
  const { has } = useCapabilities(user);
  const canManage = has("evangelism_management");

  const [territory, setTerritory] = useState<TerritoryRow | null>(null);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Saturday assignment state.
  const [saturday, setSaturday] = useState<string>("");
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [plotting, setPlotting] = useState(false);
  const [stops, setStops] = useState<StopPoint[]>([]);
  const [meetAt, setMeetAt] = useState("");
  const [planNote, setPlanNote] = useState("");

  const load = useCallback(async () => {
    const [t, z, c, f, sat] = await Promise.all([
      supabase
        .from("evangelism_territories")
        .select("id,name,description,boundary")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("evangelism_zones")
        .select("id,name,description,boundary,colour,sort_order")
        .order("sort_order"),
      supabase.rpc("evangelism_zone_coverage"),
      supabase.rpc("current_evangelism_focus"),
      supabase.rpc("next_saturday"),
    ]);
    const satDate = (sat.data as string | null) ?? "";
    setSaturday(satDate);
    if (satDate) {
      const { data: a } = await supabase.rpc("evangelism_assignment_for", { _on: satDate });
      const row = Array.isArray(a) ? (a[0] as Assignment | undefined) : undefined;
      setAssignment(row ?? null);
      setStops(row?.points ?? []);
      setMeetAt(row?.meet_at ?? "");
      setPlanNote(row?.note ?? "");
    }
    setTerritory((t.data as TerritoryRow | null) ?? null);
    setZones((z.data as ZoneRow[] | null) ?? []);
    setCoverage((c.data as Coverage[] | null) ?? []);
    const focusRow = Array.isArray(f.data) ? (f.data[0] as Focus | undefined) : undefined;
    setFocus(focusRow ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const zonesForMap = useMemo<Zone[]>(
    () =>
      zones.map((z) => {
        const cov = coverage.find((c) => c.zone_id === z.id);
        return {
          id: z.id,
          name: z.name,
          description: z.description,
          boundary: z.boundary,
          colour: z.colour,
          coverage: cov
            ? {
                contacts: cov.contacts,
                visited: cov.visited,
                baptized: cov.baptized,
                holy_ghost: cov.holy_ghost,
              }
            : undefined,
        };
      }),
    [zones, coverage],
  );

  const addStop = useCallback((p: LatLng) => {
    const stop = { lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6), label: null as string | null };
    setStops((prev) => [...prev, stop]);

    // Name the pin from the map. A route is plotted by clicking street corners,
    // and a list of raw coordinates is no use to someone standing on one. The
    // pin appears immediately and fills in its own name a moment later, so
    // plotting never waits on the network.
    (async () => {
      const { data } = await supabase.functions.invoke("geocode-address", {
        body: { lat: stop.lat, lng: stop.lng },
      });
      const label = (data as { ok?: boolean; label?: string } | null)?.label;
      if (!label) return;
      setStops((prev) =>
        prev.map((x) =>
          x.lat === stop.lat && x.lng === stop.lng && !x.label ? { ...x, label } : x,
        ),
      );
    })();
  }, []);

  const removeStop = useCallback((i: number) => {
    setStops((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const saveAssignment = async (notify: boolean) => {
    setSaving(true);
    const { data, error } = await supabase.rpc("save_evangelism_assignment", {
      _assignment_date: saturday,
      _points: stops,
      _zone_id: focus?.zone_id ?? undefined,
      _note: planNote.trim() || undefined,
      _meet_at: meetAt.trim() || undefined,
      _notify: notify,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message ?? "Could not save the assignment.");
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    toast.success(
      notify
        ? `Saved ${row?.points ?? 0} stops. ${row?.notified ?? 0} notified.`
        : `Saved ${row?.points ?? 0} stops.`,
    );
    setPlotting(false);
    load();
  };

  if (loading) return <div className="eyebrow text-muted-foreground">Loading the map…</div>;
  if (!territory) return null;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow text-accent mb-2 flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" />— Our Focus Area
          </div>
          <h2 className="font-display text-3xl">{territory.name}</h2>
          {territory.description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{territory.description}</p>
          )}
        </div>
      </div>

      {focus ? (
        <div
          className="border-l-4 bg-card p-5"
          style={{
            borderLeftColor: zones.find((z) => z.id === focus.zone_id)?.colour ?? "var(--royal)",
          }}
        >
          <div className="eyebrow text-muted-foreground text-[10px]">— This week</div>
          <div className="font-display text-2xl mt-1">{focus.zone_name}</div>
          <p className="mt-2 text-sm text-muted-foreground">
            {focus.note ?? "Our focus for the week — pray over these streets, and let's go."}
          </p>
        </div>
      ) : (
        <div className="border border-dashed border-border p-5 text-sm text-muted-foreground">
          No target set for this week{canManage ? " — choose a quadrant below." : " yet."}
        </div>
      )}

      <TerritoryMap
        territory={territory.boundary}
        zones={zonesForMap}
        focusZoneId={focus?.zone_id ?? null}
        stops={stops}
        // Click-to-plot only while plotting, so an ordinary member — or an
        // admin just reading the map — cannot drop a pin by accident.
        onMapClick={plotting ? addStop : undefined}
        onStopClick={plotting ? removeStop : undefined}
      />

      <SaturdayPlan
        saturday={saturday}
        assignment={assignment}
        stops={stops}
        plotting={plotting}
        canManage={canManage}
        saving={saving}
        meetAt={meetAt}
        planNote={planNote}
        onMeetAt={setMeetAt}
        onPlanNote={setPlanNote}
        onStartPlotting={() => setPlotting(true)}
        onCancel={() => {
          setPlotting(false);
          setStops(assignment?.points ?? []);
        }}
        onRemoveStop={removeStop}
        onSave={saveAssignment}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {zones.map((z) => {
          const cov = coverage.find((c) => c.zone_id === z.id);
          const isFocus = focus?.zone_id === z.id;
          return (
            <div key={z.id} className="border border-border p-4 text-left">
              <div className="flex items-start gap-2">
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: z.colour }}
                />
                <div className="min-w-0">
                  <div className="font-medium leading-tight">
                    {z.name}
                    {isFocus && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-accent">
                        This week
                      </span>
                    )}
                  </div>
                  {z.description && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{z.description}</div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <Stat
                      icon={<Users className="h-3 w-3" />}
                      label="contacts"
                      value={cov?.contacts ?? 0}
                    />
                    <Stat label="visited" value={cov?.visited ?? 0} />
                    <Stat label="baptized" value={cov?.baptized ?? 0} />
                    <Stat label="Holy Ghost" value={cov?.holy_ghost ?? 0} />
                  </div>
                  {(cov?.contacts ?? 0) === 0 && (
                    // Named plainly rather than left as a zero to interpret. An
                    // untouched quadrant is the most useful thing on this map.
                    <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-accent">
                      <MapPin className="h-3 w-3" /> Untouched ground
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {icon}
      <span className="font-semibold text-foreground">{value}</span> {label}
    </span>
  );
}

/**
 * This Saturday's outing: where we're meeting, and the stops in order.
 *
 * Kept separate from the territory above because the two move on different
 * clocks — the territory is the season's ground, this is redrawn every week.
 */
function SaturdayPlan({
  saturday,
  assignment,
  stops,
  plotting,
  canManage,
  saving,
  meetAt,
  planNote,
  onMeetAt,
  onPlanNote,
  onStartPlotting,
  onCancel,
  onRemoveStop,
  onSave,
}: {
  saturday: string;
  assignment: Assignment | null;
  stops: StopPoint[];
  plotting: boolean;
  canManage: boolean;
  saving: boolean;
  meetAt: string;
  planNote: string;
  onMeetAt: (v: string) => void;
  onPlanNote: (v: string) => void;
  onStartPlotting: () => void;
  onCancel: () => void;
  onRemoveStop: (i: number) => void;
  onSave: (notify: boolean) => void;
}) {
  if (!saturday) return null;

  const pretty = new Date(saturday + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow text-accent flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />— Saturday assignment
          </div>
          <div className="font-display text-2xl mt-1">{pretty}</div>
          {assignment?.zone_name && (
            <div className="text-sm text-muted-foreground">{assignment.zone_name}</div>
          )}
        </div>
        {canManage && !plotting && (
          <Button variant="outline" onClick={onStartPlotting}>
            <Plus className="mr-1.5 h-4 w-4" />
            {stops.length ? "Edit stops" : "Plot stops"}
          </Button>
        )}
      </div>

      {plotting && (
        <p className="border-l-2 border-accent bg-accent/5 py-2 pl-3 text-xs text-muted-foreground">
          Click the map to drop a stop. Click a numbered pin to remove it.
        </p>
      )}

      {assignment?.meet_at && !plotting && (
        <div className="text-sm">
          <span className="text-muted-foreground">Meeting at </span>
          <span className="font-medium">{assignment.meet_at}</span>
        </div>
      )}

      {assignment?.note && !plotting && (
        <p className="text-sm text-muted-foreground">{assignment.note}</p>
      )}

      {stops.length > 0 ? (
        <ol className="space-y-1.5">
          {stops.map((s, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-night text-[11px] font-semibold text-night-foreground">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {s.label ?? `${Number(s.lat).toFixed(4)}, ${Number(s.lng).toFixed(4)}`}
              </span>
              {plotting && (
                <button
                  type="button"
                  onClick={() => onRemoveStop(i)}
                  aria-label={`Remove stop ${i + 1}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">
          {canManage ? "No stops plotted yet." : "The stops for this week haven't been posted yet."}
        </p>
      )}

      {canManage && plotting && (
        <div className="space-y-3 border-t border-border pt-4">
          <Input
            value={meetAt}
            onChange={(e) => onMeetAt(e.target.value)}
            placeholder="Where and when to meet — e.g. the church car park, 10am"
          />
          <Textarea
            value={planNote}
            onChange={(e) => onPlanNote(e.target.value)}
            rows={2}
            placeholder="Optional — anything the team should know before Saturday."
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onSave(true)} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save and notify members
            </Button>
            <Button variant="outline" onClick={() => onSave(false)} disabled={saving}>
              Save quietly
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
