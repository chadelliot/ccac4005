import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, ImagePlus } from "lucide-react";
import { functionsBase, anonKey } from "@/lib/bishopDb";
import { EventsHeroCountdown } from "@/components/EventsHeroCountdown";

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
  /** Facebook events are read live and have no row here, so they link out
   *  rather than to an internal detail page. */
  facebookUrl?: string;
};

function PublicEventsPage() {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Two sources, one list. Member-submitted events live in the database and
      // keep their approval flow; Facebook events are read live and appear
      // automatically, so nothing has to be re-entered by hand.
      const [dbResult, fbResult] = await Promise.allSettled([
        supabase
          .from("events")
          .select("id,title,description,location,start_at,end_at,flyer_url")
          .eq("status", "approved")
          .eq("is_public", true)
          .gte("start_at", new Date().toISOString())
          .order("start_at", { ascending: true }),
        fetch(`${functionsBase()}/facebook-events`, { headers: { apikey: anonKey() } }).then((r) =>
          r.json(),
        ),
      ]);

      const fromDb: PublicEvent[] =
        dbResult.status === "fulfilled" ? ((dbResult.value.data ?? []) as PublicEvent[]) : [];

      const fromFacebook: PublicEvent[] =
        fbResult.status === "fulfilled" && Array.isArray(fbResult.value?.events)
          ? fbResult.value.events.map((e: Record<string, string | null>) => ({
              id: `fb-${e.id}`,
              title: String(e.name),
              description: e.description ?? null,
              location: e.location ?? null,
              start_at: String(e.startAt),
              end_at: e.endAt ?? null,
              flyer_url: e.cover ?? null,
              facebookUrl: String(e.permalink),
            }))
          : [];

      // Merged and re-sorted so the two sources interleave by date rather than
      // sitting in separate blocks.
      setEvents(
        [...fromDb, ...fromFacebook].sort((a, b) => a.start_at.localeCompare(b.start_at)),
      );
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen sand-page flex flex-col">
      <PageHero className="pt-32 pb-20">
        {/* Heading and countdown share one row from lg up, so the counter reads
            as part of the hero rather than a banner stacked beneath it. Below
            lg it wraps under the copy, where four large cells still fit. */}
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-10">
          <div>
            <div className="eyebrow text-gold mb-4">— Gatherings</div>
            <h1 className="font-display text-5xl md:text-6xl max-w-3xl">
              Upcoming Events
            </h1>
            <p className="mt-5 max-w-2xl text-night-foreground/70">
              Everyone is welcome. Browse our public events below and let us know you're
              coming — no account required.
            </p>
          </div>
          <EventsHeroCountdown />
        </div>
      </PageHero>

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
  const cardClass =
    "group flex flex-col border border-border bg-card hover:border-foreground/30 transition-colors overflow-hidden";

  // A Facebook event has no row in our database, so there is no internal detail
  // page to send anyone to — it links to the event on Facebook instead, where
  // the full details and RSVP already live.
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    event.facebookUrl ? (
      <a href={event.facebookUrl} target="_blank" rel="noreferrer" className={cardClass}>
        {children}
      </a>
    ) : (
      <Link to="/events/$id" params={{ id: event.id }} className={cardClass}>
        {children}
      </Link>
    );

  return (
    <Wrapper>
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
          <Badge className="bg-gold text-gold-foreground hover:bg-gold">
            {event.facebookUrl ? "On Facebook" : "Public"}
          </Badge>
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
    </Wrapper>
  );
}
