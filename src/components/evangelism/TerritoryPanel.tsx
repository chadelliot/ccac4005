import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Target, MapPin, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useCapabilities } from "@/lib/adminCapabilities";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TerritoryMap, type LatLng, type Zone } from "./TerritoryMap";

type TerritoryRow = { id: string; name: string; description: string | null; boundary: LatLng[] };
type ZoneRow = { id: string; name: string; description: string | null; boundary: LatLng[]; colour: string; sort_order: number };
type Coverage = { zone_id: string; contacts: number; gospel_shared: number; visited: number; baptized: number; holy_ghost: number };
type Focus = { zone_id: string; zone_name: string; note: string | null; week_start: string };

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
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [t, z, c, f] = await Promise.all([
      supabase.from("evangelism_territories").select("id,name,description,boundary").eq("is_active", true).limit(1).maybeSingle(),
      supabase.from("evangelism_zones").select("id,name,description,boundary,colour,sort_order").order("sort_order"),
      supabase.rpc("evangelism_zone_coverage"),
      supabase.rpc("current_evangelism_focus"),
    ]);
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
            ? { contacts: cov.contacts, visited: cov.visited, baptized: cov.baptized, holy_ghost: cov.holy_ghost }
            : undefined,
        };
      }),
    [zones, coverage],
  );

  const setWeeklyTarget = async () => {
    if (!selected) return;
    setSaving(true);
    const { data, error } = await supabase.rpc("set_evangelism_focus", {
      _zone_id: selected,
      _note: note.trim() || undefined,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message ?? "Could not set the target.");
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const n = row?.notified ?? 0;
    toast.success(`Target set. ${n} ${n === 1 ? "person" : "people"} notified.`);
    setNote("");
    setSelected(null);
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
          style={{ borderLeftColor: zones.find((z) => z.id === focus.zone_id)?.colour ?? "var(--royal)" }}
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
        focusZoneId={focus?.zone_id ?? selected}
        onZoneClick={canManage ? setSelected : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {zones.map((z) => {
          const cov = coverage.find((c) => c.zone_id === z.id);
          const isFocus = focus?.zone_id === z.id;
          const isSelected = selected === z.id;
          return (
            <button
              key={z.id}
              type="button"
              disabled={!canManage}
              onClick={() => setSelected(z.id)}
              className={`border p-4 text-left transition-colors ${
                isSelected ? "border-foreground" : "border-border"
              } ${canManage ? "hover:border-foreground/50" : "cursor-default"}`}
            >
              <div className="flex items-start gap-2">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: z.colour }} />
                <div className="min-w-0">
                  <div className="font-medium leading-tight">
                    {z.name}
                    {isFocus && <span className="ml-2 text-[10px] uppercase tracking-wider text-accent">This week</span>}
                  </div>
                  {z.description && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{z.description}</div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <Stat icon={<Users className="h-3 w-3" />} label="contacts" value={cov?.contacts ?? 0} />
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
            </button>
          );
        })}
      </div>

      {canManage && selected && (
        <div className="border border-border bg-card p-5 space-y-3">
          <div className="text-sm font-medium">
            Set “{zones.find((z) => z.id === selected)?.name}” as this week's target
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Optional — a word to the congregation about this week's focus."
          />
          <div className="flex gap-2">
            <Button onClick={setWeeklyTarget} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set target and notify members
            </Button>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
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
