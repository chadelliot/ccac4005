import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Video, MessageCircle, Globe, Copy, Check, ArrowRight, MapPin, CalendarDays } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { SiteFooter } from "@/components/SiteFooter";
import { useWeeklyServices, type UpcomingService } from "@/hooks/useWeeklyServices";

export const Route = createFileRoute("/bible-study")({
  head: () => ({
    meta: [
      { title: "Join Us Online — Christ Cathedral Apostolic" },
      {
        name: "description",
        content: "Joining Christ Cathedral Apostolic online this week — service times and the link to join.",
      },
      { property: "og:title", content: "Join us online — Christ Cathedral Apostolic" },
      {
        property: "og:description",
        content: "Service times and the link to join us online this week. Everyone is welcome.",
      },
    ],
  }),
  component: JoinPage,
});

/**
 * The page anyone can share to bring someone to a gathering.
 *
 * A short, sayable address — ccacbmore.com/bible-study — because it gets read aloud
 * from the pulpit and typed from memory. It always shows something: when a
 * gathering is online it leads with the link, and otherwise it gives the
 * ordinary times and address, so a shared link is never a dead end.
 *
 * Public by design. The point is for members to pass it to people who are not
 * members yet.
 */
function JoinPage() {
  const { upcoming, loading } = useWeeklyServices();
  const online = upcoming.filter((s) => s.virtualNow);
  const inPerson = upcoming.filter((s) => !s.virtualNow);

  return (
    <div className="min-h-screen sand-page flex flex-col">
      <PageHero className="pt-32 pb-16">
        <div className="eyebrow text-gold mb-4">— Join Us</div>
        <h1 className="font-display text-5xl md:text-6xl max-w-3xl">
          {online.length > 0 ? "We're online this week" : "Come as you are"}
        </h1>
        <p className="mt-5 max-w-2xl text-night-foreground/70">
          {online.length > 0
            ? "Share this page with anyone you'd like to join us."
            : "Our weekly gatherings — everyone is welcome, no need to tell us you're coming."}
        </p>
      </PageHero>

      <main className="flex-1 mx-auto w-full max-w-3xl px-6 lg:px-10 py-16 space-y-8">
        {loading ? (
          <div className="eyebrow text-muted-foreground">Loading…</div>
        ) : (
          <>
            {online.map((s) => (
              <OnlineCard key={s.id} service={s} />
            ))}
            {inPerson.map((s) => (
              <InPersonCard key={s.id} service={s} />
            ))}
            {upcoming.length === 0 && (
              <div className="border border-dashed border-border p-12 text-center">
                <div className="font-display text-2xl">Nothing scheduled right now</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  <Link to="/plan-visit" className="underline">
                    Plan a visit
                  </Link>{" "}
                  or{" "}
                  <Link to="/events" className="underline">
                    see upcoming events
                  </Link>
                  .
                </p>
              </div>
            )}
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function OnlineCard({ service }: { service: UpcomingService }) {
  const when = service.nextAt.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });

  const label =
    service.virtual_platform === "zoom"
      ? "On Zoom"
      : service.virtual_platform === "facebook"
        ? "In the Facebook group chat"
        : "Online";

  const Icon =
    service.virtual_platform === "zoom" ? Video : service.virtual_platform === "facebook" ? MessageCircle : Globe;

  return (
    <section
      className="overflow-hidden rounded-sm p-8 text-white"
      style={{ backgroundImage: "linear-gradient(115deg, var(--royal), var(--gold-deep))" }}
    >
      <div className="eyebrow mb-3 flex items-center gap-2 text-white/80">
        <Icon className="h-3.5 w-3.5" />— {label}
      </div>
      <h2 className="font-display text-4xl leading-tight">{service.title}</h2>
      <div className="mt-2 text-white/85">{when} · Eastern</div>

      {service.virtual_note && <p className="mt-4 text-sm text-white/85">{service.virtual_note}</p>}

      {service.virtual_link && (
        <div className="mt-6 space-y-3">
          <a
            href={service.virtual_link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-white px-6 py-3 eyebrow text-night transition-transform hover:-translate-y-0.5"
          >
            Join now <ArrowRight className="h-3.5 w-3.5" />
          </a>
          <ShareRow url={service.virtual_link} title={`Join ${service.title} — ${when}`} />
        </div>
      )}
    </section>
  );
}

function InPersonCard({ service }: { service: UpcomingService }) {
  const when = service.nextAt.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <section className="border border-border bg-card p-6">
      <div className="eyebrow text-gold-deep mb-2 flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5" />— In person
      </div>
      <h2 className="font-display text-2xl">{service.title}</h2>
      <div className="mt-1 text-sm font-medium">{when} · Eastern</div>
      {service.description && (
        <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
      )}
      {service.location && (
        <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {service.location}
        </div>
      )}
    </section>
  );
}

/**
 * Copy, and the native share sheet where the device offers one.
 *
 * navigator.share is the whole point on a phone — it opens the same sheet as
 * any other app, so the link can go to Messages, WhatsApp or the group chat
 * without anyone hunting for a paste target. Where it does not exist (most
 * desktop browsers), copy is the honest fallback rather than a button that
 * silently does nothing.
 */
function ShareRow({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="inline-flex items-center gap-1.5 border border-white/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors hover:border-white"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </button>

      {canShare && (
        <button
          type="button"
          onClick={() => navigator.share({ title, url }).catch(() => { /* dismissed */ })}
          className="inline-flex items-center gap-1.5 border border-white/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors hover:border-white"
        >
          Share
        </button>
      )}
    </div>
  );
}
