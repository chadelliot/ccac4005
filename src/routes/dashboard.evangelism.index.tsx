import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search, Phone, MapPin, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { geocodeAddress as geocodeFn } from "@/lib/evangelismGeocode";
import { listWitnesses, resolveWitnessId, splitWitnessNames, type Witness } from "@/lib/witnesses";
import { TerritoryPanel } from "@/components/evangelism/TerritoryPanel";
import { EvangelismFocusSummary } from "@/components/evangelism/EvangelismFocusSummary";
import { useCapabilities } from "@/lib/adminCapabilities";
import { addContactNote } from "@/lib/contactActivity";

export const Route = createFileRoute("/dashboard/evangelism/")({
  // ?add=1 opens the form on arrival, so "Add contact" elsewhere is one click
  // rather than landing here and asking the person to press it again.
  //
  // Returns {} rather than { add: undefined } when absent: the latter makes the
  // parameter part of the route's required shape, and every existing link to
  // this page then fails to typecheck for not passing a search object.
  validateSearch: (search: Record<string, unknown>): { add?: "1" } =>
    search.add === "1" || search.add === 1 ? { add: "1" } : {},
  head: () => ({ meta: [{ title: "Evangelism — CCAC" }] }),
  component: EvangelismPage,
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
  met_on: string;
  co_witness: string | null;
  witness_id: string | null;
  gender: string | null;
};

const contactSchema = z.object({
  first_name: z.string().trim().min(1, "First name required").max(80),
  last_name: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(200).optional(),
  where_met: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  met_on: z.string().trim().min(1, "Date met required"),
  co_witness: z.string().trim().max(120).optional(),
  gender: z.enum(["male", "female"]).optional(),
});

function today() {
  // Local date, not UTC — toISOString() would roll the outreach date forward a
  // day for anyone logging after ~7pm Eastern.
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function EvangelismPage() {
  const { user } = useSession();
  const { isLeader, loading: rolesLoading } = useRoles(user);
  const { has, loading: capLoading } = useCapabilities(user);

  // Who sees the harvest, and who sees only the week's brief.
  //
  // This mirrors the RLS policy on evangelism_contacts exactly — leaders (which
  // includes admins) and evangelism managers are the accounts the database will
  // return the full list to. Matching it here means the page never asks for
  // rows it would be refused, and an ordinary member's browser never receives
  // other people's names, numbers or addresses at all: the query is gated, not
  // the rendering. Souls are personal details of people who never signed up for
  // this site, and hiding a table client-side would still have shipped them.
  const canManage = has("evangelism_management") || isLeader;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [q, setQ] = useState("");
  const { add } = Route.useSearch();
  const [open, setOpen] = useState(add === "1");
  const [busy, setBusy] = useState(false);
  const [witnessOptions, setWitnessOptions] = useState<Witness[]>([]);
  const [witnessName, setWitnessName] = useState("");
  const [followUp, setFollowUp] = useState(false);
  // "unknown" rather than "" so the placeholder is a real choice someone can
  // return to, and so an unanswered question is never recorded as an answer.
  const [gender, setGender] = useState<string>("unknown");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  // contact id -> when anyone last reached them, from the activity timeline.
  const [lastContact, setLastContact] = useState<Map<string, string>>(new Map());

  const load = async () => {
    if (!user) return;

    // Leadership gets the whole harvest; a member gets only the souls they
    // logged. The scope is in the query rather than in the rendering — RLS
    // would also hand a member their own rows, but asking narrowly means their
    // browser never holds anyone else's name, number or address even briefly.
    const base = supabase
      .from("evangelism_contacts")
      .select("*")
      .order("met_on", { ascending: false });

    const { data, error } = await (canManage ? base : base.eq("added_by", user.id));
    if (error) toast.error(error.message);
    setContacts((data ?? []) as Contact[]);

    // One grouped read rather than a query per row. The view is security_invoker,
    // so it returns dates computed only from the activity this person may read —
    // a member is not told that an admin's note exists by way of its date.
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
  };

  // Default the witness to whoever is logging it — most souls are logged by the
  // person who met them — while still allowing another name to be typed.
  useEffect(() => {
    if (!user) return;
    listWitnesses().then(setWitnessOptions);
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setWitnessName((prev) => prev || data.display_name!);
      });
  }, [user]);

  // Deliberately no redirect here.
  //
  // This used to send every admin straight to the Executive View, which made
  // the Contacts page unreachable for them: the Add contact button bounced
  // back, and refreshing any tab landed somewhere else. Where an admin starts
  // is a job for the navigation link, not for the page they asked for —
  // a route that refuses to display itself is a trap.

  // Waits for roles and capabilities before loading: firing on mount would run
  // while canManage is still false and leave a manager looking at an empty list.
  useEffect(() => {
    if (rolesLoading || capLoading || !user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesLoading, capLoading, canManage, user]);

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const parsed = contactSchema.safeParse({
      first_name: fd.get("first_name"),
      last_name: fd.get("last_name") || undefined,
      phone: fd.get("phone") || undefined,
      address: fd.get("address") || undefined,
      where_met: fd.get("where_met") || undefined,
      notes: fd.get("notes") || undefined,
      met_on: fd.get("met_on"),
      co_witness: fd.get("co_witness") || undefined,
      gender: gender === "unknown" ? undefined : gender,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);

    // A typed name becomes a witness record so credit survives; the first name
    // given takes it, anyone else typed alongside is kept as co-witness.
    const typed = (fd.get("witness_name") as string) ?? "";
    const { primary, coWitness } = splitWitnessNames(typed);
    const witness_id = await resolveWitnessId(primary);

    const touches = Number(fd.get("follow_up_touches")) || 3;
    const interval = Number(fd.get("follow_up_interval_days")) || 3;

    const { data: inserted, error } = await supabase
      .from("evangelism_contacts")
      .insert({
        ...parsed.data,
        co_witness: parsed.data.co_witness || coWitness,
        witness_id,
        added_by: user.id,
        follow_up_opt_in: followUp,
        follow_up_touches: touches,
        follow_up_interval_days: interval,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(
      followUp
        ? `Contact added — ${touches} follow-up${touches === 1 ? "" : "s"} scheduled`
        : "Contact added",
    );
    setOpen(false);
    setFollowUp(false);
    setGender("unknown");
    (e.target as HTMLFormElement).reset();
    listWitnesses().then(setWitnessOptions);

    // Mirror the row into HARVEST LIST 2026, on the tab for the month the soul
    // was witnessed. Deliberately after the contact is saved and the dialog
    // closed: the portal is the record and the sheet is a copy, so a sheet that
    // is unreachable must never cost anyone the contact they just typed.
    void (async () => {
      const { data: sheetRes } = await supabase.functions.invoke("harvest-sheet-append", {
        body: {
          met_on: parsed.data.met_on,
          witness: primary || typed,
          where_met: parsed.data.where_met ?? "",
          name: [parsed.data.first_name, parsed.data.last_name].filter(Boolean).join(" "),
          phone: parsed.data.phone ?? "",
          notes: parsed.data.notes ?? "",
          gender: parsed.data.gender ?? "",
        },
      });
      const r = sheetRes as {
        ok?: boolean;
        configured?: boolean;
        tab?: string;
        created?: boolean;
        error?: string;
      } | null;
      if (r?.ok) {
        toast.success(`Added to the ${r.tab} tab of the harvest list.`);
      } else if (r && r.configured !== false) {
        toast.error(`Saved here, but not written to the sheet: ${r.error ?? "unknown reason"}`);
      }
    })();

    // A note typed while logging the contact starts the timeline, so the first
    // entry is what was said at the door rather than the first follow-up days
    // later. Fire-and-forget, and a no-op for members — writing notes is an
    // admin act and the insert policy enforces that regardless of who asks.
    if (inserted?.id && parsed.data.notes) {
      void addContactNote(inserted.id, parsed.data.notes);
    }

    // fire-and-forget geocoding
    const query = parsed.data.address || parsed.data.where_met;
    if (inserted?.id && query) {
      geocodeFn({ data: { query } })
        .then(async (r) => {
          if (r.ok && r.latitude != null && r.longitude != null) {
            await supabase
              .from("evangelism_contacts")
              .update({
                latitude: r.latitude,
                longitude: r.longitude,
                city: r.city,
                region: r.region,
                country: r.country,
                geocoded_at: new Date().toISOString(),
              })
              .eq("id", inserted.id);
          }
        })
        .catch(() => {});
    }
    load();
  };

  const monthKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  };

  const matchesSearch = (c: Contact) => {
    const text =
      `${c.first_name} ${c.last_name ?? ""} ${c.phone ?? ""} ${c.where_met ?? ""}`.toLowerCase();
    return text.includes(q.toLowerCase());
  };

  // Segmenting the harvest is how the men's and women's ministries find the
  // souls that are theirs to follow up. "Not recorded" is a segment of its own
  // rather than a leftover, because it is the list someone has to work through.
  const matchesGender = (c: Contact) => {
    if (genderFilter === "all") return true;
    if (genderFilter === "unknown") return c.gender == null;
    return c.gender === genderFilter;
  };

  const nowKey = monthKey(new Date().toISOString());
  const currentMonthContacts = useMemo(
    () =>
      contacts
        .filter((c) => monthKey(c.met_on) === nowKey)
        .filter(matchesSearch)
        .filter(matchesGender),
    [contacts, q, nowKey, genderFilter],
  );

  const monthKeys = useMemo(() => {
    const set = new Set(contacts.map((c) => monthKey(c.met_on)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [contacts]);

  const locationOptions = useMemo(() => {
    const set = new Set(contacts.map((c) => (c.where_met ?? "").trim()).filter(Boolean));
    return Array.from(set).sort();
  }, [contacts]);

  const [sortMode, setSortMode] = useState<"alpha" | "recent">("recent");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  const allFiltered = useMemo(() => {
    let list = contacts.filter(matchesSearch).filter(matchesGender);
    if (monthFilter !== "all") list = list.filter((c) => monthKey(c.met_on) === monthFilter);
    if (sortMode === "alpha") {
      list = [...list].sort((a, b) =>
        `${a.first_name} ${a.last_name ?? ""}`.localeCompare(
          `${b.first_name} ${b.last_name ?? ""}`,
        ),
      );
    } else {
      list = [...list].sort((a, b) => b.met_on.localeCompare(a.met_on));
    }
    return list;
  }, [contacts, q, monthFilter, sortMode, genderFilter]);

  // One dialog, two homes: leadership opens it from the Contacts header,
  // members from their briefing. Members keep the ability to log a soul —
  // the point of the restriction is other people's contacts, not their own
  // work — so the form must not live inside the leadership branch.
  const addContactDialog = (triggerLabel: string) => (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-night text-night-foreground hover:bg-night/90 rounded-none px-6 py-6 eyebrow">
          <Plus className="h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">New Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First name</Label>
              <Input name="first_name" required maxLength={80} />
            </div>
            <div>
              <Label>Last name</Label>
              <Input name="last_name" maxLength={80} />
            </div>
          </div>
          <div>
            <Label>Phone</Label>
            <Input name="phone" type="tel" maxLength={40} />
          </div>
          <div>
            <Label>Address</Label>
            <Input name="address" maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Where we met</Label>
              <Input
                name="where_met"
                maxLength={120}
                list="outreach-locations"
                placeholder="Eastpoint Mall"
              />
              {/* Suggests locations already in use so the same place doesn't
                    get logged three different ways and split the reporting. */}
              <datalist id="outreach-locations">
                {locationOptions.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </div>
            <div>
              <Label>Date met</Label>
              <Input name="met_on" type="date" required defaultValue={today()} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Who witnessed</Label>
              <Input
                name="witness_name"
                maxLength={120}
                list="witness-names"
                value={witnessName}
                onChange={(e) => setWitnessName(e.target.value)}
                placeholder="Your name"
              />
              <datalist id="witness-names">
                {witnessOptions.map((w) => (
                  <option key={w.id} value={w.name} />
                ))}
              </datalist>
            </div>
            <div>
              <Label>Alongside (optional)</Label>
              <Input name="co_witness" maxLength={120} placeholder="Second witness" />
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Not recorded</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              name="notes"
              rows={3}
              maxLength={2000}
              placeholder="What stood out? Prayer needs?"
            />
          </div>

          <div className="border border-border p-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={followUp}
                onChange={(e) => setFollowUp(e.target.checked)}
                className="h-4 w-4 accent-current"
              />
              <span className="eyebrow">Set follow-up reminders</span>
            </label>
            {followUp && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>How many touches</Label>
                  <Input name="follow_up_touches" type="number" min={1} max={12} defaultValue={3} />
                </div>
                <div>
                  <Label>Every (days)</Label>
                  <Input
                    name="follow_up_interval_days"
                    type="number"
                    min={1}
                    max={90}
                    defaultValue={3}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-night text-night-foreground hover:bg-night/90 rounded-none py-6 eyebrow"
            >
              {busy ? "Saving..." : "Save Contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  // Held until roles and capabilities are known. Rendering the leadership
  // branch optimistically would mount TerritoryPanel for a member and fire its
  // boundary and coverage queries before the branch flipped — the leak this
  // whole split exists to prevent, delivered in the first 200ms.
  if (rolesLoading || capLoading) {
    return <div className="eyebrow text-muted-foreground">Loading…</div>;
  }

  // An ordinary member's page: the week's brief, a way to log a soul, and the
  // souls they logged themselves.
  //
  // Their own harvest is theirs to keep track of — who they met, whether that
  // person has been baptized since. What stays absent is everyone else's work:
  // no territory map, no quadrant coverage, no soul counts, no church-wide
  // list. None of that is rendered here and none of it is fetched.
  if (!canManage) {
    return (
      <div className="space-y-8 max-w-3xl">
        <EvangelismFocusSummary />

        <div>{addContactDialog("Add a Soul")}</div>

        <div className="space-y-4">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="eyebrow text-accent mb-2">— Your harvest</div>
              <h2 className="font-display text-3xl">Souls you've logged ({contacts.length})</h2>
            </div>
          </div>

          {/* Search earns its place once a member has logged a season's worth
              and is trying to remember one name. */}
          {contacts.length > 6 && (
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search your contacts..."
                className="pl-9"
              />
            </div>
          )}

          <ContactList
            contacts={allFiltered}
            lastContact={lastContact}
            emptyText={
              q ? "No contacts match that search." : "No souls logged yet. Add the first one above."
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <TerritoryPanel />

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow text-accent mb-2">— Evangelism</div>
          <h1 className="font-display text-5xl">Contacts</h1>
          <p className="text-muted-foreground mt-2">
            People we've met, prayed with, and are following up on.
          </p>
        </div>
        <div className="flex gap-2">{addContactDialog("Add Contact")}</div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[15rem] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search contacts..."
            className="pl-9"
          />
        </div>
        <Select value={genderFilter} onValueChange={setGenderFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            <SelectItem value="male">Men</SelectItem>
            <SelectItem value="female">Women</SelectItem>
            <SelectItem value="unknown">Not recorded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="month" className="space-y-6">
        <TabsList>
          <TabsTrigger value="month">This Month ({currentMonthContacts.length})</TabsTrigger>
          <TabsTrigger value="all">All Contacts ({contacts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="month" className="space-y-4">
          <div className="eyebrow text-muted-foreground text-xs">— {monthLabel(nowKey)}</div>
          <ContactList
            contacts={currentMonthContacts}
            lastContact={lastContact}
            emptyText="No contacts added this month yet."
          />
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by month" />
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
            <Select value={sortMode} onValueChange={(v) => setSortMode(v as "alpha" | "recent")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most recent</SelectItem>
                <SelectItem value="alpha">A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ContactList
            contacts={allFiltered}
            lastContact={lastContact}
            emptyText="No contacts match these filters."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function lastContactLabel(iso: string | undefined) {
  if (!iso) return null;
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  // Days for the recent past, a date once that stops being the useful unit —
  // "11 days ago" answers the question, "Jun 3" answers it for June.
  if (days <= 0) return "Contacted today";
  if (days === 1) return "Contacted yesterday";
  if (days < 30) return `Contacted ${days} days ago`;
  return `Contacted ${then.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function ContactList({
  contacts,
  lastContact,
  emptyText,
}: {
  contacts: Contact[];
  lastContact: Map<string, string>;
  emptyText: string;
}) {
  if (contacts.length === 0) {
    return (
      <div className="border border-dashed border-border p-16 text-center">
        <div className="eyebrow text-muted-foreground">{emptyText}</div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {contacts.map((c) => (
        <Link
          key={c.id}
          to="/dashboard/evangelism/$id"
          params={{ id: c.id }}
          className="flex items-center justify-between gap-4 bg-card border border-border p-5 hover:border-foreground/30 hover:bg-muted/30 transition-colors group cursor-pointer"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="font-display text-xl underline-offset-4 group-hover:underline">
                {c.first_name} {c.last_name}
              </div>
              {c.baptized && (
                <Badge variant="secondary" className="bg-accent/20 text-accent-foreground">
                  Baptized
                </Badge>
              )}
              {c.holy_ghost && (
                <Badge variant="secondary" className="bg-night text-night-foreground">
                  Holy Ghost
                </Badge>
              )}
              {c.visited && <Badge variant="outline">Visited</Badge>}
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
              {c.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {c.phone}
                </span>
              )}
              {c.where_met && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {c.where_met}
                </span>
              )}
              {/* The day they were witnessed to — the date the harvest list
                  keeps and the one that decides which month they belong to.
                  The record's creation date is bookkeeping, not ministry. */}
              <span>
                {new Date(c.met_on + "T12:00:00").toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              {/* Whether anyone has been back since. A soul met in March and
                  never called again should not look like one called yesterday. */}
              {(() => {
                const label = lastContactLabel(lastContact.get(c.id));
                return label ? (
                  <span className="text-foreground/70">{label}</span>
                ) : (
                  <span className="italic">Not contacted yet</span>
                );
              })()}
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs eyebrow text-muted-foreground group-hover:text-foreground shrink-0">
            <span className="hidden sm:inline">View</span>
            <ChevronRight className="h-5 w-5" />
          </div>
        </Link>
      ))}
    </div>
  );
}
