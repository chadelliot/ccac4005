import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  MapPin,
  Users,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EvangelismMap, type MapContact } from "@/components/evangelism/EvangelismMap";
import { DeleteContactDialog } from "@/components/evangelism/DeleteContactDialog";
import { geocodeAddress as geocodeFn } from "@/lib/evangelismGeocode";
import { TerritoryPanel } from "@/components/evangelism/TerritoryPanel";

export const Route = createFileRoute("/dashboard/evangelism/admin")({
  head: () => ({ meta: [{ title: "Evangelism Admin — CCAC" }] }),
  component: EvangelismAdmin,
});

type Contact = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  where_met: string | null;
  notes: string | null;
  visited: boolean;
  baptized: boolean;
  holy_ghost: boolean;
  gospel_shared: boolean;
  status: string;
  added_by: string;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  geocoded_at: string | null;
  witness_id: string | null;
};

type FollowUp = {
  id: string;
  contact_id: string;
  due_date: string;
  touch_number: number;
  completed: boolean;
};

type Profile = { id: string; display_name: string | null };
type Witness = { id: string; name: string; linked_user_id: string | null };


function fullName(c: Contact) {
  return `${c.first_name}${c.last_name ? " " + c.last_name : ""}`.trim();
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function EvangelismAdmin() {
  const { user, loading: sessionLoading } = useSession();
  const { isAdmin, loading: rolesLoading } = useRoles(user);
  const navigate = useNavigate();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [backfilling, setBackfilling] = useState(false);

  // gate
  useEffect(() => {
    if (!sessionLoading && !rolesLoading && user && !isAdmin) {
      toast.error("Admins only");
      navigate({ to: "/dashboard/evangelism" });
    }
  }, [sessionLoading, rolesLoading, user, isAdmin, navigate]);

  const load = async () => {
    setLoadingData(true);
    const [{ data: c }, { data: f }, { data: p }, { data: w }] = await Promise.all([
      supabase.from("evangelism_contacts").select("*").order("created_at", { ascending: false }),
      supabase.from("contact_follow_ups").select("id, contact_id, due_date, touch_number, completed"),
      supabase.from("profiles").select("id, display_name"),
      supabase.from("witnesses").select("id, name, linked_user_id").order("name"),
    ]);
    setContacts((c ?? []) as Contact[]);
    setFollowUps((f ?? []) as FollowUp[]);
    const map: Record<string, Profile> = {};
    (p ?? []).forEach((row) => {
      map[row.id] = row as Profile;
    });
    setProfiles(map);
    setWitnesses((w ?? []) as Witness[]);
    setLoadingData(false);
  };


  useEffect(() => {
    if (!sessionLoading && !rolesLoading && user && isAdmin) load();
  }, [sessionLoading, rolesLoading, user, isAdmin]);

  // backfill geocoding for contacts missing coords
  const backfillGeocodes = async () => {
    const missing = contacts.filter(
      (c) => c.latitude == null && (c.address || c.where_met),
    );
    if (missing.length === 0) {
      toast.info("All contacts already mapped");
      return;
    }
    setBackfilling(true);
    let ok = 0;
    let fail = 0;
    for (const c of missing) {
      const query = (c.address && c.address.trim()) || c.where_met!.trim();
      try {
        const result = await geocodeFn({ data: { query } });
        if (result.ok && result.latitude != null && result.longitude != null) {
          const { error } = await supabase
            .from("evangelism_contacts")
            .update({
              latitude: result.latitude,
              longitude: result.longitude,
              city: result.city,
              region: result.region,
              country: result.country,
              geocoded_at: new Date().toISOString(),
            })
            .eq("id", c.id);
          if (error) fail++;
          else ok++;
        } else {
          fail++;
        }
      } catch {
        fail++;
      }
      // gentle pacing
      await new Promise((r) => setTimeout(r, 120));
    }
    setBackfilling(false);
    toast.success(`Mapped ${ok} contact${ok === 1 ? "" : "s"}${fail ? `, ${fail} failed` : ""}`);
    load();
  };

  // ---- derived data ----
  const monthKeys = useMemo(() => {
    const set = new Set(contacts.map((c) => monthKey(c.created_at)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [contacts]);

  const addedByOptions = useMemo(() => {
    const set = new Set(contacts.map((c) => c.added_by));
    return Array.from(set).map((id) => ({ id, name: profiles[id]?.display_name || "Unknown" }));
  }, [contacts, profiles]);

  const whereMetOptions = useMemo(() => {
    const set = new Set(contacts.map((c) => c.where_met).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [contacts]);

  const witnessById = useMemo(() => {
    const m: Record<string, Witness> = {};
    witnesses.forEach((w) => (m[w.id] = w));
    return m;
  }, [witnesses]);

  const soulsByWitness = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of contacts) if (c.witness_id) m[c.witness_id] = (m[c.witness_id] ?? 0) + 1;
    return m;
  }, [contacts]);


  const followUpByContact = useMemo(() => {
    const m: Record<string, { total: number; done: number; overdue: number; nextDue: string | null }> = {};
    const today = new Date().toISOString().slice(0, 10);
    for (const f of followUps) {
      const slot = (m[f.contact_id] ??= { total: 0, done: 0, overdue: 0, nextDue: null });
      slot.total++;
      if (f.completed) slot.done++;
      else if (f.due_date < today) slot.overdue++;
      if (!f.completed && (!slot.nextDue || f.due_date < slot.nextDue)) slot.nextDue = f.due_date;
    }
    return m;
  }, [followUps]);

  // ---- map data + stats ----
  const mapContacts: MapContact[] = useMemo(
    () =>
      contacts
        .filter((c) => c.latitude != null && c.longitude != null)
        .map((c) => ({
          id: c.id,
          name: fullName(c),
          latitude: c.latitude!,
          longitude: c.longitude!,
          where_met: c.where_met,
          created_at: c.created_at,
        })),
    [contacts],
  );

  const stats = useMemo(() => {
    return {
      total: contacts.length,
      gospel: contacts.filter((c) => c.gospel_shared).length,
      baptized: contacts.filter((c) => c.baptized).length,
      holyGhost: contacts.filter((c) => c.holy_ghost).length,
      visited: contacts.filter((c) => c.visited).length,
      mapped: mapContacts.length,
    };
  }, [contacts, mapContacts]);

  const [topRange, setTopRange] = useState<"12mo" | "all">("12mo");
  const topLocations = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);
    const cutoffIso = cutoff.toISOString();
    const counts: Record<string, number> = {};
    for (const c of contacts) {
      if (topRange === "12mo" && c.created_at < cutoffIso) continue;
      const key = (c.where_met && c.where_met.trim()) || c.city || "Unspecified";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [contacts, topRange]);

  // ---- all-contacts table filters ----
  const [q, setQ] = useState("");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [whereFilter, setWhereFilter] = useState<string>("all");
  const [addedByFilter, setAddedByFilter] = useState<string>("all");
  const [journeyFilter, setJourneyFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<"recent" | "oldest" | "alpha">("recent");

  const filtered = useMemo(() => {
    let list = contacts;
    const ql = q.trim().toLowerCase();
    if (ql) {
      list = list.filter((c) =>
        `${fullName(c)} ${c.phone ?? ""} ${c.where_met ?? ""}`.toLowerCase().includes(ql),
      );
    }
    if (monthFilter !== "all") list = list.filter((c) => monthKey(c.created_at) === monthFilter);
    if (whereFilter !== "all") list = list.filter((c) => c.where_met === whereFilter);
    if (addedByFilter !== "all") list = list.filter((c) => c.added_by === addedByFilter);
    if (journeyFilter !== "all") {
      list = list.filter((c) => (c as any)[journeyFilter] === true);
    }
    if (sortMode === "alpha") list = [...list].sort((a, b) => fullName(a).localeCompare(fullName(b)));
    else if (sortMode === "oldest") list = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    else list = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return list;
  }, [contacts, q, monthFilter, whereFilter, addedByFilter, journeyFilter, sortMode]);

  // ---- follow-up tracker filters ----
  const [touchFilter, setTouchFilter] = useState<"all" | "overdue" | "awaiting">("all");
  const trackerContacts = useMemo(() => {
    return contacts
      .map((c) => ({ contact: c, fu: followUpByContact[c.id] || { total: 0, done: 0, overdue: 0, nextDue: null } }))
      .filter(({ fu }) => {
        if (touchFilter === "overdue") return fu.overdue > 0;
        if (touchFilter === "awaiting") return fu.done === 0;
        return true;
      })
      .sort((a, b) => b.fu.overdue - a.fu.overdue);
  }, [contacts, followUpByContact, touchFilter]);

  if (sessionLoading || rolesLoading || !user) {
    return <div className="eyebrow text-muted-foreground">Loading...</div>;
  }
  if (!isAdmin) return null;

  return (
    <div className="space-y-8 max-w-7xl">
      <Link
        to="/dashboard/evangelism"
        className="eyebrow text-muted-foreground inline-flex items-center gap-2 hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> All Contacts
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow text-accent mb-2">— Evangelism Admin</div>
          <h1 className="font-display text-5xl">Executive View</h1>
          <p className="text-muted-foreground mt-2">
            Every soul, every touch, every outreach — at a glance.
          </p>
        </div>
        <Button
          onClick={backfillGeocodes}
          disabled={backfilling || loadingData}
          variant="outline"
          className="rounded-none eyebrow"
        >
          {backfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {backfilling ? "Mapping..." : "Geocode missing"}
        </Button>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Stat label="Total souls" value={stats.total} />
        <Stat label="Gospel shared" value={stats.gospel} />
        <Stat label="Visited" value={stats.visited} />
        <Stat label="Baptized" value={stats.baptized} />
        <Stat label="Holy Ghost" value={stats.holyGhost} />
        <Stat label="On the map" value={stats.mapped} />
      </div>

      <Tabs defaultValue="map" className="space-y-6">
        <TabsList>
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="all">All Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="touches">Follow-ups</TabsTrigger>
          <TabsTrigger value="witnesses">Witnesses ({witnesses.length})</TabsTrigger>
        </TabsList>


        {/* MAP */}
        <TabsContent value="map" className="space-y-5">
          {/* The territory first: it is the frame the contacts sit inside, and
              it reads even when nothing has been geocoded yet. */}
          <TerritoryPanel />

          <EvangelismMap
            contacts={mapContacts}
            onMarkerClick={(m) => navigate({ to: "/dashboard/evangelism/$id", params: { id: m.id } })}
          />
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-card border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="eyebrow text-accent">— Top Outreach Locations</div>
                <Select value={topRange} onValueChange={(v) => setTopRange(v as "12mo" | "all")}>
                  <SelectTrigger className="w-[160px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12mo">Last 12 months</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {topLocations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data for this range yet.</p>
              ) : (
                <div className="space-y-2">
                  {topLocations.map(([name, count], i) => {
                    const max = topLocations[0][1];
                    const pct = Math.round((count / max) * 100);
                    return (
                      <div key={name} className="flex items-center gap-3">
                        <div className="w-5 text-xs eyebrow text-muted-foreground">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-sm font-medium truncate">{name}</div>
                            <div className="text-sm tabular-nums text-muted-foreground">{count}</div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="bg-card border border-border p-5">
              <div className="eyebrow text-accent mb-4">— Snapshot</div>
              <p className="text-sm text-muted-foreground mb-3">
                <strong className="text-foreground">{stats.mapped}</strong> of{" "}
                <strong className="text-foreground">{stats.total}</strong> souls are pinned on the map.
              </p>
              {stats.total > stats.mapped && (
                <p className="text-xs text-muted-foreground">
                  {stats.total - stats.mapped} contact{stats.total - stats.mapped === 1 ? "" : "s"} need
                  geocoding. Click <em>Geocode missing</em> above to plot them.
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ALL CONTACTS */}
        <TabsContent value="all" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, phone, where met..."
                className="pl-9"
              />
            </div>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {monthKeys.map((k) => <SelectItem key={k} value={k}>{monthLabel(k)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={whereFilter} onValueChange={setWhereFilter}>
              <SelectTrigger><SelectValue placeholder="Where met" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {whereMetOptions.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={addedByFilter} onValueChange={setAddedByFilter}>
              <SelectTrigger><SelectValue placeholder="Added by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                {addedByOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={journeyFilter} onValueChange={setJourneyFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Journey" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All journey stages</SelectItem>
                <SelectItem value="gospel_shared">Gospel shared</SelectItem>
                <SelectItem value="visited">Visited church</SelectItem>
                <SelectItem value="baptized">Baptized</SelectItem>
                <SelectItem value="holy_ghost">Holy Ghost</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortMode} onValueChange={(v) => setSortMode(v as typeof sortMode)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most recent</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="alpha">A–Z</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground self-center">
              Showing {filtered.length} of {contacts.length}
            </div>
          </div>

          <div className="border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Witness</TableHead>
                  <TableHead>Added by</TableHead>
                  <TableHead>Where met</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Journey</TableHead>
                  <TableHead>Touches</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingData ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No contacts match these filters.</TableCell></TableRow>
                ) : filtered.map((c) => {
                  const fu = followUpByContact[c.id] || { total: 0, done: 0, overdue: 0, nextDue: null };
                  const witness = c.witness_id ? witnessById[c.witness_id] : null;
                  return (
                    <TableRow key={c.id} className="group">
                      <TableCell>
                        <Link to="/dashboard/evangelism/$id" params={{ id: c.id }} className="font-medium hover:underline">
                          {fullName(c)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{witness ? witness.name : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{profiles[c.added_by]?.display_name ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.where_met ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.phone ?? "—"}</TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {c.gospel_shared && <Badge variant="outline" className="text-[10px]">Gospel</Badge>}
                          {c.visited && <Badge variant="outline" className="text-[10px]">Visited</Badge>}
                          {c.baptized && <Badge className="text-[10px] bg-accent/20 text-accent-foreground">Baptized</Badge>}
                          {c.holy_ghost && <Badge className="text-[10px] bg-night text-night-foreground">HG</Badge>}
                          {!c.gospel_shared && !c.visited && !c.baptized && !c.holy_ghost && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {fu.total > 0 ? (
                          <span className={fu.overdue ? "text-destructive" : "text-muted-foreground"}>
                            {fu.done}/{fu.total} done{fu.overdue ? ` · ${fu.overdue} overdue` : ""}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}
                      </TableCell>
                      <TableCell>
                        <DeleteContactDialog contactId={c.id} contactName={fullName(c)} onDeleted={load} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* FOLLOW-UPS */}
        <TabsContent value="touches" className="space-y-4">
          <div className="flex gap-2">
            <FilterChip active={touchFilter === "all"} onClick={() => setTouchFilter("all")}>All</FilterChip>
            <FilterChip active={touchFilter === "overdue"} onClick={() => setTouchFilter("overdue")}>Overdue</FilterChip>
            <FilterChip active={touchFilter === "awaiting"} onClick={() => setTouchFilter("awaiting")}>Awaiting first touch</FilterChip>
          </div>
          <div className="space-y-2">
            {trackerContacts.length === 0 ? (
              <div className="border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                Nothing matches this filter.
              </div>
            ) : trackerContacts.map(({ contact: c, fu }) => (
              <Link
                key={c.id}
                to="/dashboard/evangelism/$id"
                params={{ id: c.id }}
                className="flex items-center justify-between gap-4 bg-card border border-border p-4 hover:border-foreground/30 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="font-medium">{fullName(c)}</div>
                    <span className="text-xs text-muted-foreground">{profiles[c.added_by]?.display_name ?? ""}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {fu.done}/{fu.total || 0} touches complete
                    {fu.nextDue && <> · next due {new Date(fu.nextDue + "T00:00:00").toLocaleDateString()}</>}
                    {c.where_met && <> · {c.where_met}</>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {fu.overdue > 0 ? (
                    <Badge variant="outline" className="text-destructive border-destructive/40">
                      <AlertCircle className="h-3 w-3" /> {fu.overdue} overdue
                    </Badge>
                  ) : fu.done === fu.total && fu.total > 0 ? (
                    <Badge className="bg-accent/20 text-accent-foreground">
                      <CheckCircle2 className="h-3 w-3" /> Complete
                    </Badge>
                  ) : (
                    <Badge variant="secondary">In progress</Badge>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        </TabsContent>

        {/* WITNESSES */}
        <TabsContent value="witnesses" className="space-y-4">
          <WitnessesPanel
            witnesses={witnesses}
            profiles={Object.values(profiles)}
            soulsByWitness={soulsByWitness}
            onChanged={load}
          />
        </TabsContent>
      </Tabs>

    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card border border-border p-4">
      <div className="eyebrow text-[10px] text-muted-foreground">{label}</div>
      <div className="font-display text-3xl mt-1">{value}</div>
    </div>
  );
}

function FilterChip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`eyebrow text-xs px-3 py-1.5 border transition-colors ${
        active ? "bg-night text-night-foreground border-night" : "bg-card border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function WitnessesPanel({
  witnesses,
  profiles,
  soulsByWitness,
  onChanged,
}: {
  witnesses: Witness[];
  profiles: Profile[];
  soulsByWitness: Record<string, number>;
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? "")),
    [profiles],
  );

  const addWitness = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy("new");
    const { error } = await supabase.from("witnesses").insert({ name });
    setBusy(null);
    if (error) return toast.error(error.message);
    setNewName("");
    toast.success("Witness added");
    onChanged();
  };

  const setLink = async (id: string, userId: string | null) => {
    setBusy(id);
    const { error } = await supabase.from("witnesses").update({ linked_user_id: userId }).eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(userId ? "Linked to user — past souls now visible to them" : "Unlinked");
    onChanged();
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete witness "${name}"? Souls credited to them will keep their record but lose the credit link.`)) return;
    setBusy(id);
    const { error } = await supabase.from("witnesses").delete().eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Witness deleted");
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border p-4 flex gap-2 items-center">
        <Input
          placeholder="Add a witness (e.g. Sister Mary)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addWitness()}
          className="max-w-sm"
        />
        <Button
          onClick={addWitness}
          disabled={busy === "new" || !newName.trim()}
          className="rounded-none eyebrow bg-night text-night-foreground hover:bg-night/90"
        >
          Add Witness
        </Button>
        <p className="text-xs text-muted-foreground ml-auto">
          Link a witness to a user account to give them visibility on souls they ministered to.
        </p>
      </div>

      <div className="border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Souls credited</TableHead>
              <TableHead>Linked user account</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {witnesses.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No witnesses yet.</TableCell></TableRow>
            ) : witnesses.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-medium">{w.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums">{soulsByWitness[w.id] ?? 0}</TableCell>
                <TableCell>
                  <Select
                    value={w.linked_user_id ?? "none"}
                    onValueChange={(v) => setLink(w.id, v === "none" ? null : v)}
                    disabled={busy === w.id}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="Not linked" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Not linked —</SelectItem>
                      {sortedProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.display_name ?? "Unnamed user"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === w.id}
                    onClick={() => remove(w.id, w.name)}
                    className="text-destructive hover:text-destructive"
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// silence unused-import lint
void Users;
