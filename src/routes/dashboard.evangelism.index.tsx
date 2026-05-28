import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search, Phone, MapPin, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
};

const contactSchema = z.object({
  first_name: z.string().trim().min(1, "First name required").max(80),
  last_name: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(200).optional(),
  where_met: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
});

function EvangelismPage() {
  const { user } = useSession();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("evangelism_contacts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setContacts((data ?? []) as Contact[]);
  };

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
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase.from("evangelism_contacts").insert({ ...parsed.data, added_by: user.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Contact added — 3 follow-up touches scheduled");
    setOpen(false);
    (e.target as HTMLFormElement).reset();
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
    () => contacts.filter((c) => monthKey(c.created_at) === nowKey).filter(matchesSearch),
    [contacts, q, nowKey],
  );

  const monthKeys = useMemo(() => {
    const set = new Set(contacts.map((c) => monthKey(c.created_at)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [contacts]);

  const [sortMode, setSortMode] = useState<"alpha" | "recent">("recent");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  const allFiltered = useMemo(() => {
    let list = contacts.filter(matchesSearch);
    if (monthFilter !== "all") list = list.filter((c) => monthKey(c.created_at) === monthFilter);
    if (sortMode === "alpha") {
      list = [...list].sort((a, b) =>
        `${a.first_name} ${a.last_name ?? ""}`.localeCompare(`${b.first_name} ${b.last_name ?? ""}`),
      );
    } else {
      list = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return list;
  }, [contacts, q, monthFilter, sortMode]);

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="eyebrow text-accent mb-2">— Evangelism</div>
          <h1 className="font-display text-5xl">Contacts</h1>
          <p className="text-muted-foreground mt-2">People we've met, prayed with, and are following up on.</p>
        </div>
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
              <div>
                <Label>Where we met</Label>
                <Input name="where_met" maxLength={120} placeholder="Old Town Mall, door-to-door, etc." />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea name="notes" rows={3} maxLength={2000} placeholder="What stood out? Prayer needs?" />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy} className="w-full bg-night text-night-foreground hover:bg-night/90 rounded-none py-6 eyebrow">
                  {busy ? "Saving..." : "Save & Schedule Follow-ups"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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

