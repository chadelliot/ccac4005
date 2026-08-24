import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { geocodeAddress as geocodeFn } from "@/lib/evangelismGeocode";
import { listWitnesses, resolveWitnessId, splitWitnessNames, type Witness } from "@/lib/witnesses";
import { TerritoryPanel } from "@/components/evangelism/TerritoryPanel";

export const Route = createFileRoute("/dashboard/evangelism/")({
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
  const { isAdmin, loading: rolesLoading } = useRoles(user);
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [witnessOptions, setWitnessOptions] = useState<Witness[]>([]);
  const [witnessName, setWitnessName] = useState("");
  const [followUp, setFollowUp] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("evangelism_contacts")
      .select("*")
      .order("met_on", { ascending: false });
    if (error) toast.error(error.message);
    setContacts((data ?? []) as Contact[]);
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

  useEffect(() => {
    if (isAdmin) navigate({ to: "/dashboard/evangelism/admin", replace: true });
  }, [isAdmin, navigate]);

  useEffect(() => {
    load();
  }, []);

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
    (e.target as HTMLFormElement).reset();
    listWitnesses().then(setWitnessOptions);
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
    const text = `${c.first_name} ${c.last_name ?? ""} ${c.phone ?? ""} ${c.where_met ?? ""}`.toLowerCase();
    return text.includes(q.toLowerCase());
  };

  const nowKey = monthKey(new Date().toISOString());
  const currentMonthContacts = useMemo(
    () => contacts.filter((c) => monthKey(c.met_on) === nowKey).filter(matchesSearch),
    [contacts, q, nowKey],
  );

  const monthKeys = useMemo(() => {
    const set = new Set(contacts.map((c) => monthKey(c.met_on)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [contacts]);

  const locationOptions = useMemo(() => {
    const set = new Set(
      contacts.map((c) => (c.where_met ?? "").trim()).filter(Boolean),
    );
    return Array.from(set).sort();
  }, [contacts]);

  const [sortMode, setSortMode] = useState<"alpha" | "recent">("recent");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  const allFiltered = useMemo(() => {
    let list = contacts.filter(matchesSearch);
    if (monthFilter !== "all") list = list.filter((c) => monthKey(c.met_on) === monthFilter);
    if (sortMode === "alpha") {
      list = [...list].sort((a, b) =>
        `${a.first_name} ${a.last_name ?? ""}`.localeCompare(`${b.first_name} ${b.last_name ?? ""}`),
      );
    } else {
      list = [...list].sort((a, b) => b.met_on.localeCompare(a.met_on));
    }
    return list;
  }, [contacts, q, monthFilter, sortMode]);

  return (
    <div className="space-y-8 max-w-6xl">
      <TerritoryPanel />

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow text-accent mb-2">— Evangelism</div>
          <h1 className="font-display text-5xl">Contacts</h1>
          <p className="text-muted-foreground mt-2">People we've met, prayed with, and are following up on.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-night text-night-foreground hover:bg-night/90 rounded-none px-6 py-6 eyebrow">
              <Plus className="h-4 w-4" /> Add Contact
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
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea name="notes" rows={3} maxLength={2000} placeholder="What stood out? Prayer needs?" />
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
                      <Input
                        name="follow_up_touches"
                        type="number"
                        min={1}
                        max={12}
                        defaultValue={3}
                      />
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
                <Button type="submit" disabled={busy} className="w-full bg-night text-night-foreground hover:bg-night/90 rounded-none py-6 eyebrow">
                  {busy ? "Saving..." : "Save Contact"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts..." className="pl-9" />
      </div>

      <Tabs defaultValue="month" className="space-y-6">
        <TabsList>
          <TabsTrigger value="month">This Month ({currentMonthContacts.length})</TabsTrigger>
          <TabsTrigger value="all">All Contacts ({contacts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="month" className="space-y-4">
          <div className="eyebrow text-muted-foreground text-xs">— {monthLabel(nowKey)}</div>
          <ContactList contacts={currentMonthContacts} emptyText="No contacts added this month yet." />
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
                  <SelectItem key={k} value={k}>{monthLabel(k)}</SelectItem>
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
          <ContactList contacts={allFiltered} emptyText="No contacts match these filters." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContactList({ contacts, emptyText }: { contacts: Contact[]; emptyText: string }) {
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
              <div className="font-display text-xl underline-offset-4 group-hover:underline">{c.first_name} {c.last_name}</div>
              {c.baptized && <Badge variant="secondary" className="bg-accent/20 text-accent-foreground">Baptized</Badge>}
              {c.holy_ghost && <Badge variant="secondary" className="bg-night text-night-foreground">Holy Ghost</Badge>}
              {c.visited && <Badge variant="outline">Visited</Badge>}
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
              {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
              {c.where_met && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.where_met}</span>}
              <span>{new Date(c.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
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

