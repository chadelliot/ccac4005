import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
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
import { ContactActions } from "@/components/evangelism/ContactActions";
import { ContactCard } from "@/components/evangelism/ContactCard";
import { FollowUpQueue } from "@/components/evangelism/FollowUpQueue";
import { useCapabilities } from "@/lib/adminCapabilities";
import { useStickyState, useStickyScroll } from "@/hooks/useStickyState";

export const Route = createFileRoute("/dashboard/evangelism/admin")({
  head: () => ({ meta: [{ title: "Evangelism Overview — CCAC" }] }),
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
  met_on: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  geocoded_at: string | null;
  witness_id: string | null;
  gender: string | null;
  is_focus: boolean;
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
  const [execTab, setExecTab] = useStickyState<string>("evg.exec.tab", "map");
  useStickyScroll("evg.exec.scroll", contacts.length > 0);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  // Same source the contact list uses, so the card shows the same
  // "contacted N days ago" here as it does there.
  const [lastContact, setLastContact] = useState<Map<string, string>>(new Map());
  const { has } = useCapabilities(user);

  const setFocusLocally = (id: string, next: boolean) =>
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, is_focus: next } : c)));

  // The date a soul was actually met, not the date somebody typed them in.
  // Eighty-three of these were entered in one sitting during the harvest-list
  // import, so created_at would file them all under August and make seven
  // months of outreach look like a single afternoon. Falls back to created_at
  // for anything recorded before met_on existed.
  const metOn = (c: { met_on: string | null; created_at: string }) => c.met_on ?? c.created_at;
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
    const [{ data: c }, { data: p }, { data: w }] = await Promise.all([
      supabase.from("evangelism_contacts").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, display_name"),
      supabase.from("witnesses").select("id, name, linked_user_id").order("name"),
    ]);
    const { data: activity } = await supabase
      .from("contact_last_activity")
      .select("contact_id, last_activity_at");
    setLastContact(
      new Map(
        (activity ?? [])
          .filter((r) => r.contact_id && r.last_activity_at)
          .map((r) => [r.contact_id as string, r.last_activity_at as string]),
      ),
    );
    setContacts((c ?? []) as Contact[]);
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
    const missing = contacts.filter((c) => c.latitude == null && (c.address || c.where_met));
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
    const set = new Set(contacts.map((c) => monthKey(metOn(c))));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [contacts]);

  const whereMetOptions = useMemo(() => {
    const set = new Set(contacts.map((c) => c.where_met).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [contacts]);

  const witnessById = useMemo(() => {
    const m: Record<string, Witness> = {};
    witnesses.forEach((w) => (m[w.id] = w));
    return m;
  }, [witnesses]);

  // Who witnessed, not who typed it in. The account that created a record is
  // an implementation detail — the whole harvest list was imported under one
  // login, so filtering by it would offer a single meaningless option.
  const witnessOptions = useMemo(() => {
    const ids = new Set(contacts.map((c) => c.witness_id).filter(Boolean) as string[]);
    return Array.from(ids)
      .map((id) => ({ id, name: witnessById[id]?.name ?? "Unknown" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, witnessById]);

  const soulsByWitness = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of contacts) if (c.witness_id) m[c.witness_id] = (m[c.witness_id] ?? 0) + 1;
    return m;
  }, [contacts]);

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
      if (topRange === "12mo" && metOn(c) < cutoffIso) continue;
      const key = (c.where_met && c.where_met.trim()) || c.city || "Unspecified";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [contacts, topRange]);

  // ---- all-contacts table filters ----
  const [q, setQ] = useState("");
  // The filters that decide which rows are on screen survive a reload, so
  // returning from Messages does not mean rebuilding the view by hand.
  const [monthFilter, setMonthFilter] = useStickyState<string>("evg.exec.month", "all");
  const [whereFilter, setWhereFilter] = useStickyState<string>("evg.exec.where", "all");
  const [witnessFilter, setWitnessFilter] = useStickyState<string>("evg.exec.witness", "all");
  const [journeyFilter, setJourneyFilter] = useStickyState<string>("evg.exec.journey", "all");
  const [genderFilter, setGenderFilter] = useStickyState<string>("evg.exec.gender", "all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Shown on the collapsed button so a filter left on from last week is
  // visible rather than a mystery about why the list looks short.
  const activeFilterCount = [
    monthFilter,
    whereFilter,
    witnessFilter,
    journeyFilter,
    genderFilter,
  ].filter((f) => f !== "all").length;
  const [sortMode, setSortMode] = useStickyState<"recent" | "oldest" | "alpha">(
    "evg.exec.sort",
    "recent",
  );

  const filtered = useMemo(() => {
    let list = contacts;
    const ql = q.trim().toLowerCase();
    if (ql) {
      list = list.filter((c) =>
        `${fullName(c)} ${c.phone ?? ""} ${c.where_met ?? ""}`.toLowerCase().includes(ql),
      );
    }
    if (monthFilter !== "all") list = list.filter((c) => monthKey(metOn(c)) === monthFilter);
    if (whereFilter !== "all") list = list.filter((c) => c.where_met === whereFilter);
    // Alongside the other filters, not instead of them.
    if (genderFilter !== "all") {
      list = list.filter((c) =>
        genderFilter === "unknown" ? c.gender == null : c.gender === genderFilter,
      );
    }
    if (witnessFilter !== "all") list = list.filter((c) => c.witness_id === witnessFilter);
    if (journeyFilter !== "all") {
      // Typed rather than cast through any: these four are the boolean columns
      // on the contact, and naming them means a renamed column fails the build
      // instead of silently filtering nothing.
      const field = journeyFilter as "gospel_shared" | "visited" | "baptized" | "holy_ghost";
      list = list.filter((c) => c[field] === true);
    }
    if (sortMode === "alpha")
      list = [...list].sort((a, b) => fullName(a).localeCompare(fullName(b)));
    else if (sortMode === "oldest")
      list = [...list].sort((a, b) => metOn(a).localeCompare(metOn(b)));
    else list = [...list].sort((a, b) => metOn(b).localeCompare(metOn(a)));
    return list;
  }, [contacts, q, monthFilter, whereFilter, witnessFilter, journeyFilter, genderFilter, sortMode]);

  // ---- follow-up tracker filters ----

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
          <h1 className="font-display text-5xl">Evangelism Overview</h1>
          <p className="text-muted-foreground mt-2">
            Every soul, every touch, every outreach — at a glance.
          </p>
        </div>
        {/* Adding a soul is what people come here to do; plotting old ones on
            the map is housekeeping. The prominent button now says so, and the
            geocode control moved down beside the map where its effect is
            visible and its name means something in context. */}
        <Button asChild className="rounded-none eyebrow">
          <Link to="/dashboard/evangelism" search={{ add: "1" }}>
            <Plus className="h-4 w-4" /> Add contact
          </Link>
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

      <Tabs value={execTab} onValueChange={setExecTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="all">All Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="touches">Follow-ups</TabsTrigger>
          <TabsTrigger value="witnesses">Witnesses ({witnesses.length})</TabsTrigger>
        </TabsList>

        {/* MAP */}
        <TabsContent value="map" className="space-y-5">
          <div className="flex justify-end">
            <Button
              onClick={backfillGeocodes}
              disabled={backfilling || loadingData}
              variant="ghost"
              size="sm"
              className="rounded-none eyebrow text-xs text-muted-foreground"
              title="Look up coordinates for contacts recorded without them, so they appear on the map"
            >
              {backfilling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <MapPin className="h-3 w-3" />
              )}
              {backfilling ? "Mapping…" : "Plot missing contacts on the map"}
            </Button>
          </div>
          {/* The territory first: it is the frame the contacts sit inside, and
              it reads even when nothing has been geocoded yet. */}
          <TerritoryPanel />

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
                            <div className="text-sm tabular-nums text-muted-foreground">
                              {count}
                            </div>
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
                <strong className="text-foreground">{stats.total}</strong> souls are pinned on the
                map.
              </p>
              {stats.total > stats.mapped && (
                <p className="text-xs text-muted-foreground">
                  {stats.total - stats.mapped} contact{stats.total - stats.mapped === 1 ? "" : "s"}{" "}
                  need geocoding.
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ALL CONTACTS */}
        <TabsContent value="all" className="space-y-4">
          {/* Search always visible; the rest folds away on a phone so the
              first contact is not four dropdowns down the page. */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, phone, where met..."
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="eyebrow shrink-0 rounded-none md:hidden"
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Button>
          </div>

          <div className={`${filtersOpen ? "block" : "hidden"} space-y-3 md:block`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  {monthKeys.map((k) => (
                    <SelectItem key={k} value={k}>
                      {monthLabel(k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={whereFilter} onValueChange={setWhereFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Where met" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {whereMetOptions.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={witnessFilter} onValueChange={setWitnessFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Who witnessed" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All witnesses</SelectItem>
                  {witnessOptions.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={journeyFilter} onValueChange={setJourneyFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Journey" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All journey stages</SelectItem>
                  <SelectItem value="gospel_shared">Gospel shared</SelectItem>
                  <SelectItem value="visited">Visited church</SelectItem>
                  <SelectItem value="baptized">Baptized</SelectItem>
                  <SelectItem value="holy_ghost">Holy Ghost</SelectItem>
                </SelectContent>
              </Select>
              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="unknown">Not recorded</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as typeof sortMode)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
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
          </div>

          {/* One contacts experience, two presentations of it.
              Both render `filtered` — the same array, the same filters, the same
              handlers. A phone gets the cards the Contacts page already uses
              rather than a seven-column table squeezed to 390px, and nothing
              about the data or the logic is duplicated to achieve that. */}
          <div className="hidden border border-border bg-card overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Witness</TableHead>
                  <TableHead>Where met</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Journey</TableHead>
                  <TableHead>Last touch</TableHead>
                  <TableHead>Date witnessed</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingData ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No contacts match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => {
                    const witness = c.witness_id ? witnessById[c.witness_id] : null;
                    const lastTouch = lastContact.get(c.id);
                    return (
                      <TableRow key={c.id} className="group">
                        <TableCell>
                          <Link
                            to="/dashboard/evangelism/$id"
                            params={{ id: c.id }}
                            className="font-medium hover:underline"
                          >
                            {fullName(c)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          {witness ? (
                            witness.name
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.where_met ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {/* Number shown exactly as typed; the buttons carry the
                            normalised form. */}
                          <div className="space-y-1.5">
                            <div>{c.phone ?? "—"}</div>
                            <ContactActions
                              contactId={c.id}
                              phone={c.phone}
                              firstName={c.first_name}
                              status={c.status}
                              size="sm"
                              showInvite={false}
                            />
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {c.gospel_shared && (
                              <Badge variant="outline" className="text-[10px]">
                                Gospel
                              </Badge>
                            )}
                            {c.visited && (
                              <Badge variant="outline" className="text-[10px]">
                                Visited
                              </Badge>
                            )}
                            {c.baptized && (
                              <Badge className="text-[10px] bg-accent/20 text-accent-foreground">
                                Baptized
                              </Badge>
                            )}
                            {c.holy_ghost && (
                              <Badge className="text-[10px] bg-night text-night-foreground">
                                HG
                              </Badge>
                            )}
                            {!c.gospel_shared && !c.visited && !c.baptized && !c.holy_ghost && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        {/* When anyone last reached this soul, from the activity
                            timeline — a text, a call, an invite, or a note being
                            written or revised. Reads against Date witnessed in the
                            next column: met in March, last touched in March, and
                            the gap speaks for itself. Scheduled touches are a plan;
                            this is what actually happened. */}
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {lastTouch ? (
                            new Date(lastTouch).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "2-digit",
                            })
                          ) : (
                            <span className="italic">Never</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(metOn(c)).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <DeleteContactDialog
                            contactId={c.id}
                            contactName={fullName(c)}
                            onDeleted={load}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 md:hidden">
            {loadingData ? (
              <div className="border border-dashed border-border p-12 text-center">
                <div className="eyebrow text-muted-foreground">Loading contacts...</div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="border border-dashed border-border p-12 text-center">
                <div className="eyebrow text-muted-foreground">
                  No contacts match these filters.
                </div>
              </div>
            ) : (
              filtered.map((c) => (
                <ContactCard
                  key={c.id}
                  contact={c}
                  lastContactAt={lastContact.get(c.id)}
                  userId={user?.id}
                  canManageEvangelism={has("evangelism_management")}
                  onFocusChange={setFocusLocally}
                  trailing={
                    <DeleteContactDialog
                      contactId={c.id}
                      contactName={fullName(c)}
                      onDeleted={load}
                    />
                  }
                />
              ))
            )}
          </div>
        </TabsContent>

        {/* FOLLOW-UPS */}
        <TabsContent value="touches" className="space-y-4">
          {/* Actual follow-up records. This tab used to list every soul in the
              book with "0/0 touches complete" beside them, which read as
              eighty-five pending follow-ups when the table held one. */}
          <FollowUpQueue />
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
    const { error } = await supabase
      .from("witnesses")
      .update({ linked_user_id: userId })
      .eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(userId ? "Linked to user — past souls now visible to them" : "Unlinked");
    onChanged();
  };

  const remove = async (id: string, name: string) => {
    if (
      !confirm(
        `Delete witness "${name}"? Souls credited to them will keep their record but lose the credit link.`,
      )
    )
      return;
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
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No witnesses yet.
                </TableCell>
              </TableRow>
            ) : (
              witnesses.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {soulsByWitness[w.id] ?? 0}
                  </TableCell>
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
                          <SelectItem key={p.id} value={p.id}>
                            {p.display_name ?? "Unnamed user"}
                          </SelectItem>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// silence unused-import lint
void Users;
