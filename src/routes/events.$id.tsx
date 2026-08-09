import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, MapPin, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/events/$id")({
  component: PublicEventDetail,
});

type PublicEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  flyer_url: string | null;
};

const rsvpSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  email: z.string().trim().email("Enter a valid email").max(200),
  response: z.enum(["going", "maybe"]),
});

function PublicEventDetail() {
  const { id } = Route.useParams();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("id,title,description,location,start_at,end_at,flyer_url")
        .eq("id", id)
        .eq("status", "approved")
        .eq("is_public", true)
        .maybeSingle();
      if (!data) setMissing(true);
      else setEvent(data as PublicEvent);
      setLoading(false);
    })();
  }, [id]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-night text-night-foreground">
        <SiteHeader />
      </div>

      <main className="flex-1 mx-auto max-w-7xl w-full px-6 lg:px-10 py-16">
        <Link
          to="/events"
          className="eyebrow text-muted-foreground hover:text-foreground inline-flex items-center gap-2 mb-8"
        >
          <ArrowLeft className="h-3 w-3" /> All events
        </Link>

        {loading ? (
          <div className="eyebrow text-muted-foreground">Loading…</div>
        ) : missing || !event ? (
          <div className="border border-dashed border-border p-12 text-center">
            <div className="font-display text-2xl mb-2">Event not found</div>
            <p className="text-sm text-muted-foreground">
              It may have been removed or is not shared publicly.
            </p>
          </div>
        ) : (
          <EventBody event={event} />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function EventBody({ event }: { event: PublicEvent }) {
  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : null;

  return (
    <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10">
      <div className="space-y-6">
        {event.flyer_url && (
          <div className="aspect-[4/3] bg-muted overflow-hidden border border-border">
            <img src={event.flyer_url} alt={event.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div>
          <div className="eyebrow text-accent mb-3">— Event</div>
          <h1 className="font-display text-4xl md:text-5xl">{event.title}</h1>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <div>
                {start.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <div className="text-muted-foreground">
                {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                {end && ` – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
              </div>
            </div>
          </div>
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>{event.location}</div>
            </div>
          )}
        </div>
        {event.description && (
          <div className="prose prose-sm max-w-none text-foreground/90 whitespace-pre-wrap">
            {event.description}
          </div>
        )}
      </div>

      <aside className="lg:sticky lg:top-8 self-start">
        <GuestRsvpForm eventId={event.id} eventTitle={event.title} />
      </aside>
    </div>
  );
}

function GuestRsvpForm({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [response, setResponse] = useState<"going" | "maybe">("going");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = rsvpSchema.safeParse({ name, email, response });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("event_guest_rsvps").insert({
      event_id: eventId,
      name: parsed.data.name,
      email: parsed.data.email,
      response: parsed.data.response,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "Could not RSVP");
      return;
    }
    setDone(true);
    toast.success("RSVP received — thank you!");
  };

  if (done) {
    return (
      <div className="border border-border bg-card p-8 text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
        <div className="font-display text-2xl">You're on the list</div>
        <p className="text-sm text-muted-foreground">
          Thanks for letting us know you're {response === "going" ? "coming" : "considering"}{" "}
          to <span className="font-medium text-foreground">{eventTitle}</span>. We can't wait to
          see you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border bg-card p-6 space-y-4">
      <div>
        <div className="eyebrow text-accent mb-2">— RSVP</div>
        <div className="font-display text-2xl leading-tight">Let us know you're coming</div>
        <p className="text-xs text-muted-foreground mt-1">
          No account needed. We'll only use your details for this event.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rsvp-name">Full name</Label>
        <Input
          id="rsvp-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rsvp-email">Email</Label>
        <Input
          id="rsvp-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={200}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Response</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setResponse("going")}
            className={`eyebrow text-xs py-2.5 border transition-colors ${
              response === "going"
                ? "bg-night text-night-foreground border-night"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            I'm Going
          </button>
          <button
            type="button"
            onClick={() => setResponse("maybe")}
            className={`eyebrow text-xs py-2.5 border transition-colors ${
              response === "maybe"
                ? "bg-night text-night-foreground border-night"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Maybe
          </button>
        </div>
      </div>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Submitting…" : "Submit RSVP"}
      </Button>
    </form>
  );
}
