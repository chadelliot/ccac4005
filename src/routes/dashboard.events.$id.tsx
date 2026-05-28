import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Calendar, Check, X, Users, Download, Pencil } from "lucide-react";
import { StatusBadge } from "./dashboard.events.index";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const editSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  start_at: z.string().min(1, "Start date/time is required"),
  end_at: z.string().optional().or(z.literal("")),
  is_public: z.boolean(),
});

export const Route = createFileRoute("/dashboard/events/$id")({
  head: () => ({ meta: [{ title: "Event — CCAC" }] }),
  component: EventDetailPage,
});

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  flyer_url: string | null;
  is_public: boolean;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  submitted_by: string;
  approved_at: string | null;
};

type Rsvp = { response: "going" | "maybe" | "not_going" };

type GuestRsvp = {
  id: string;
  name: string;
  email: string;
  response: "going" | "maybe" | "not_going";
  created_at: string;
};

function EventDetailPage() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const { isAdmin, isLeader } = useRoles(user);
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvp, setRsvp] = useState<Rsvp | null>(null);
  const [rsvpCounts, setRsvpCounts] = useState({ going: 0, maybe: 0, not_going: 0 });
  const [rejectionReason, setRejectionReason] = useState("");
  const [working, setWorking] = useState(false);
  const [guestRsvps, setGuestRsvps] = useState<GuestRsvp[]>([]);
  const [editOpen, setEditOpen] = useState(false);


  const load = async () => {
    setLoading(true);
    const [{ data: ev }, { data: myRsvp }, { data: counts }] = await Promise.all([
      supabase.from("events").select("*").eq("id", id).maybeSingle(),
      user
        ? supabase
            .from("event_rsvps")
            .select("response")
            .eq("event_id", id)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("event_rsvps").select("response").eq("event_id", id),
    ]);
    setEvent((ev ?? null) as EventRow | null);
    setRsvp((myRsvp ?? null) as Rsvp | null);
    const c = { going: 0, maybe: 0, not_going: 0 };
    (counts ?? []).forEach((r: any) => {
      if (r.response in c) (c as any)[r.response]++;
    });
    setRsvpCounts(c);

    if (isAdmin || isLeader) {
      const { data: guests } = await supabase
        .from("event_guest_rsvps")
        .select("id,name,email,response,created_at")
        .eq("event_id", id)
        .order("created_at", { ascending: false });
      setGuestRsvps((guests ?? []) as GuestRsvp[]);
    } else {
      setGuestRsvps([]);
    }
    setLoading(false);
  };

  const exportGuestsCsv = () => {
    if (!event) return;
    const header = ["Name", "Email", "Response", "Submitted at"];
    const rows = guestRsvps.map((g) => [
      g.name,
      g.email,
      g.response,
      new Date(g.created_at).toISOString(),
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell ?? "");
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    a.href = url;
    a.download = `guest-rsvps-${slug || event.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id, isAdmin, isLeader]);

  const setMyRsvp = async (response: Rsvp["response"]) => {
    if (!user || !event) return;
    const { error } = await supabase
      .from("event_rsvps")
      .upsert(
        { event_id: event.id, user_id: user.id, response },
        { onConflict: "event_id,user_id" },
      );
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("RSVP saved");
    load();
  };

  const approve = async () => {
    if (!event) return;
    setWorking(true);
    const { error } = await supabase
      .from("events")
      .update({
        status: "approved",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq("id", event.id);
    setWorking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event approved — members notified");
    load();
  };

  const reject = async () => {
    if (!event) return;
    if (!rejectionReason.trim()) {
      toast.error("Add a reason so the submitter knows what to fix");
      return;
    }
    setWorking(true);
    const { error } = await supabase
      .from("events")
      .update({
        status: "rejected",
        rejection_reason: rejectionReason.trim(),
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", event.id);
    setWorking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event rejected");
    load();
  };

  const remove = async () => {
    if (!event) return;
    if (!confirm("Delete this event?")) return;
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event deleted");
    navigate({ to: "/dashboard/events" });
  };

  if (loading) return <div className="eyebrow text-muted-foreground">Loading…</div>;
  if (!event)
    return (
      <div className="space-y-4">
        <div className="font-display text-2xl">Event not found</div>
        <Link to="/dashboard/events" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to events
        </Link>
      </div>
    );

  const isOwner = user?.id === event.submitted_by;
  const canEdit = isAdmin || (isOwner && event.status === "pending");
  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : null;


      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          to="/dashboard/events"
          className="inline-flex items-center gap-2 text-xs eyebrow text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> All events
        </Link>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit event
          </Button>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        {editOpen && (
          <EditEventDialog
            event={event}
            onSaved={() => {
              setEditOpen(false);
              load();
            }}
          />
        )}
      </Dialog>

      </Link>

      <div className="grid md:grid-cols-[1fr_1.2fr] gap-8">
        <div className="bg-muted overflow-hidden">
          {event.flyer_url ? (
            <img src={event.flyer_url} alt={event.title} className="w-full h-auto" />
          ) : (
            <div className="aspect-[4/5] flex items-center justify-center text-muted-foreground eyebrow">
              No flyer
            </div>
          )}
        </div>
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <StatusBadge status={event.status} />
            {event.is_public && (
              <span className="eyebrow text-[10px] text-muted-foreground">— Public</span>
            )}
          </div>
          <h1 className="font-display text-4xl leading-tight">{event.title}</h1>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {start.toLocaleString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {end && ` – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-foreground">
                <MapPin className="h-4 w-4 text-muted-foreground" /> {event.location}
              </div>
            )}
          </div>

          {event.description && (
            <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
              {event.description}
            </p>
          )}

          {event.status === "rejected" && event.rejection_reason && (
            <div className="border border-destructive/40 bg-destructive/5 p-4 text-sm">
              <div className="eyebrow text-destructive mb-1">Rejection reason</div>
              {event.rejection_reason}
            </div>
          )}

          {/* RSVP */}
          {event.status === "approved" && (
            <div className="space-y-3 pt-2">
              <div className="eyebrow text-muted-foreground">— Will you be there?</div>
              <div className="flex gap-2 flex-wrap">
                <RsvpButton
                  active={rsvp?.response === "going"}
                  onClick={() => setMyRsvp("going")}
                  label="Going"
                />
                <RsvpButton
                  active={rsvp?.response === "maybe"}
                  onClick={() => setMyRsvp("maybe")}
                  label="Maybe"
                />
                <RsvpButton
                  active={rsvp?.response === "not_going"}
                  onClick={() => setMyRsvp("not_going")}
                  label="Can't make it"
                />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> {rsvpCounts.going} going
                </span>
                <span>{rsvpCounts.maybe} maybe</span>
                <span>{rsvpCounts.not_going} can't</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Admin approval panel */}
      {isAdmin && event.status === "pending" && (
        <div className="border border-border bg-card p-6 space-y-4">
          <div className="eyebrow text-accent">— Admin review</div>
          <div className="font-display text-2xl">Approve or request changes</div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={approve} disabled={working}>
              <Check className="h-4 w-4" /> Approve & notify members
            </Button>
          </div>
          <div className="space-y-2 pt-2">
            <Label htmlFor="reason">Rejection reason (required to reject)</Label>
            <Textarea
              id="reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="Let the submitter know what needs to change…"
            />
            <Button variant="destructive" onClick={reject} disabled={working}>
              <X className="h-4 w-4" /> Reject
            </Button>
          </div>
        </div>
      )}

      {/* Status change for already-decided events (admin only) */}
      {isAdmin && event.status !== "pending" && (
        <div className="border border-border bg-card p-6 space-y-3">
          <div className="eyebrow text-muted-foreground">— Change status</div>
          <div className="flex gap-2 flex-wrap">
            {event.status !== "approved" && (
              <Button onClick={approve} disabled={working} variant="outline">
                <Check className="h-4 w-4" /> Approve
              </Button>
            )}
            {event.status !== "rejected" && (
              <>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={2}
                  placeholder="Reason for rejection"
                  className="max-w-md"
                />
                <Button variant="destructive" onClick={reject} disabled={working}>
                  <X className="h-4 w-4" /> Reject
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Guest RSVPs (admin/leader only, public events) */}
      {(isAdmin || isLeader) && event.is_public && event.status === "approved" && (
        <div className="border border-border bg-card p-6 space-y-4">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <div className="eyebrow text-accent">— Guest RSVPs</div>
              <div className="font-display text-2xl">
                Public sign-ups{" "}
                <span className="text-muted-foreground text-base font-sans">
                  ({guestRsvps.length})
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Non-members who RSVP'd from the public events page.
              </p>
            </div>
            <Button
              onClick={exportGuestsCsv}
              disabled={guestRsvps.length === 0}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>

          {guestRsvps.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed border-border p-6 text-center">
              No guest RSVPs yet.
            </div>
          ) : (
            <div className="border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead className="text-right">Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guestRsvps.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell>
                        <a
                          href={`mailto:${g.email}`}
                          className="text-foreground hover:underline"
                        >
                          {g.email}
                        </a>
                      </TableCell>
                      <TableCell>
                        <GuestResponseBadge response={g.response} />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">
                        {new Date(g.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}


      {(isOwner || isAdmin) && (
        <div className="pt-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={remove} className="text-destructive">
            Delete event
          </Button>
        </div>
      )}
    </div>
  );
}

function GuestResponseBadge({ response }: { response: GuestRsvp["response"] }) {
  if (response === "going")
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Going</Badge>;
  if (response === "maybe")
    return <Badge className="bg-amber-500 hover:bg-amber-500 text-night">Maybe</Badge>;
  return <Badge variant="outline">Can't make it</Badge>;
}

function RsvpButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm border transition-colors ${
        active
          ? "bg-night text-night-foreground border-night"
          : "border-border hover:border-foreground/40"
      }`}
    >
      {label}
    </button>
  );
}
