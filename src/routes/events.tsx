import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, ImagePlus } from "lucide-react";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Upcoming Events — Christ Cathedral Apostolic" },
      {
        name: "description",
        content:
          "Browse upcoming public events at Christ Cathedral Apostolic. Everyone welcome — RSVP and join us.",
      },
      { property: "og:title", content: "Upcoming Events — Christ Cathedral Apostolic" },
      {
        property: "og:description",
        content: "Public gatherings, services, and outreach events. RSVP — no account needed.",
      },
    ],
  }),
  component: PublicEventsPage,
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

function PublicEventsPage() {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("id,title,description,location,start_at,end_at,flyer_url")
        .eq("status", "approved")
        .eq("is_public", true)
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true });
      setEvents((data ?? []) as PublicEvent[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-night text-night-foreground relative">
        <SiteHeader />
        <div className="mx-auto max-w-7xl px-6 lg:px-10 pt-32 pb-20">
          <div className="eyebrow text-gold mb-4">— Gatherings</div>
          <h1 className="font-display text-5xl md:text-6xl max-w-3xl">
            Upcoming Events
          </h1>
          <p className="mt-5 max-w-2xl text-night-foreground/70">
            Everyone is welcome. Browse our public events below and let us know you're
            coming — no account required.
          </p>
        </div>
      </div>

      <main className="flex-1 mx-auto max-w-7xl w-full px-6 lg:px-10 py-16">
        {loading ? (
          <div className="eyebrow text-muted-foreground">Loading…</div>
        ) : events.length === 0 ? (
          <div className="border border-dashed border-border p-12 text-center">
            <div className="eyebrow text-muted-foreground mb-2">— Nothing scheduled</div>
            <div className="font-display text-2xl">No upcoming public events</div>
            <p className="text-sm text-muted-foreground mt-2">
              Check back soon, or{" "}
              <Link to="/plan-visit" className="underline">
                plan a visit
              </Link>{" "}
              to a Sunday service.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((e) => (
              <PublicEventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function PublicEventCard({ event }: { event: PublicEvent }) {
  const start = new Date(event.start_at);
  return (
    <Link
      to="/events/$id"
      params={{ id: event.id }}
      className="group flex flex-col border border-border bg-card hover:border-foreground/30 transition-colors overflow-hidden"
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
          <Badge className="bg-gold text-gold-foreground hover:bg-gold">Public</Badge>
        </div>
      </div>
      <div className="p-5 space-y-2 flex-1">
        <div className="eyebrow text-muted-foreground text-[10px] flex items-center gap-1.5">
          <Calendar className="h-3 w-3" />
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
