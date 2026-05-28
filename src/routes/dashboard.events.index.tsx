import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Calendar, MapPin, Plus, ImagePlus } from "lucide-react";

export const Route = createFileRoute("/dashboard/events/")({
  head: () => ({ meta: [{ title: "Events — CCAC" }] }),
  component: EventsPage,
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

const eventSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  start_at: z.string().min(1, "Start date/time is required"),
  end_at: z.string().optional().or(z.literal("")),
  is_public: z.boolean(),
});

function EventsPage() {
  const { user } = useSession();
  const { isAdmin } = useRoles(user);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "mine">("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("events")
      .select("*")
      .order("start_at", { ascending: true });
    setEvents((data ?? []) as EventRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const filtered = useMemo(() => {
    if (!user) return [];
    return events.filter((e) => {
      if (filter === "pending") return e.status === "pending";
      if (filter === "approved") return e.status === "approved";
      if (filter === "mine") return e.submitted_by === user.id;
      return true;
    });
  }, [events, filter, user]);

  const pendingCount = events.filter((e) => e.status === "pending").length;

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow text-accent mb-3">— Events</div>
          <h1 className="font-display text-5xl">Gatherings</h1>
          <p className="text-muted-foreground mt-3">
            Submit flyers for approval, RSVP to upcoming events, and share publicly.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Submit Event
            </Button>
          </DialogTrigger>
          <SubmitEventDialog
            onSubmitted={() => {
              setDialogOpen(false);
              load();
            }}
          />
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </FilterPill>
        <FilterPill active={filter === "approved"} onClick={() => setFilter("approved")}>
          Approved
        </FilterPill>
        <FilterPill active={filter === "pending"} onClick={() => setFilter("pending")}>
          Pending {isAdmin && pendingCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-semibold h-4 min-w-4 px-1">
              {pendingCount}
            </span>
          )}
        </FilterPill>
        <FilterPill active={filter === "mine"} onClick={() => setFilter("mine")}>
          Mine
        </FilterPill>
      </div>

      {loading ? (
        <div className="text-muted-foreground eyebrow">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border p-12 text-center">
          <div className="eyebrow text-muted-foreground mb-2">— Nothing here yet</div>
          <div className="font-display text-2xl mb-2">No events to show</div>
          <p className="text-sm text-muted-foreground">
            Submit a flyer above to get the ball rolling.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`eyebrow text-xs px-3 py-1.5 rounded-sm border transition-colors ${
        active
          ? "bg-night text-night-foreground border-night"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function EventCard({ event }: { event: EventRow }) {
  const start = new Date(event.start_at);
  return (
    <Link
      to="/dashboard/events/$id"
      params={{ id: event.id }}
      className="group flex flex-col border border-border bg-card hover:border-foreground/20 transition-colors overflow-hidden"
    >
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        {event.flyer_url ? (
          <img
            src={event.flyer_url}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImagePlus className="h-8 w-8" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <StatusBadge status={event.status} />
        </div>
        {event.is_public && (
          <div className="absolute top-3 right-3">
            <Badge variant="outline" className="bg-background/80 backdrop-blur">
              Public
            </Badge>
          </div>
        )}
      </div>
      <div className="p-5 space-y-2 flex-1">
        <div className="eyebrow text-muted-foreground text-[10px]">
          {start.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
          {" · "}
          {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </div>
        <div className="font-display text-xl leading-tight">{event.title}</div>
        {event.location && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" /> {event.location}
          </div>
        )}
      </div>
    </Link>
  );
}

export function StatusBadge({ status }: { status: EventRow["status"] }) {
  if (status === "approved")
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Approved</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge className="bg-amber-500 hover:bg-amber-500 text-night">Pending</Badge>;
}

function SubmitEventDialog({ onSubmitted }: { onSubmitted: () => void }) {
  const { user } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [flyer, setFlyer] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const parsed = eventSchema.safeParse({
      title,
      description,
      location,
      start_at: startAt,
      end_at: endAt,
      is_public: isPublic,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setSubmitting(true);
    try {
      let flyer_url: string | null = null;
      if (flyer) {
        if (flyer.size > 5 * 1024 * 1024) {
          toast.error("Flyer must be under 5MB");
          setSubmitting(false);
          return;
        }
        const ext = flyer.name.split(".").pop() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("event-flyers")
          .upload(path, flyer, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("event-flyers").getPublicUrl(path);
        flyer_url = pub.publicUrl;
      }

      const { error } = await supabase.from("events").insert({
        title: parsed.data.title,
        description: parsed.data.description || null,
        location: parsed.data.location || null,
        start_at: new Date(parsed.data.start_at).toISOString(),
        end_at: parsed.data.end_at ? new Date(parsed.data.end_at).toISOString() : null,
        is_public: parsed.data.is_public,
        flyer_url,
        submitted_by: user.id,
      });
      if (error) throw error;
      toast.success("Submitted for approval");
      // reset
      setTitle("");
      setDescription("");
      setLocation("");
      setStartAt("");
      setEndAt("");
      setIsPublic(false);
      setFlyer(null);
      onSubmitted();
    } catch (err: any) {
      toast.error(err.message ?? "Could not submit event");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Submit an Event</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={2000}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="start">Starts</Label>
            <Input
              id="start"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end">Ends</Label>
            <Input id="end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="flyer">Flyer image (optional, max 5MB)</Label>
          <Input
            id="flyer"
            type="file"
            accept="image/*"
            onChange={(e) => setFlyer(e.target.files?.[0] ?? null)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-4 w-4"
          />
          Share publicly on the website once approved
        </label>
        <DialogFooter>
          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? "Submitting…" : "Submit for approval"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
