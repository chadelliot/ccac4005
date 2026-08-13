import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Radio, CalendarDays, HeartHandshake } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { SiteFooter } from "@/components/SiteFooter";
import { useLiveStream, type FacebookVideo } from "@/hooks/useLiveStream";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Watch Live — Christ Cathedral Apostolic Church" },
      {
        name: "description",
        content:
          "Watch Christ Cathedral Apostolic Church live from Baltimore. Sunday worship begins at 2:27 PM.",
      },
      { property: "og:title", content: "Watch Live — Christ Cathedral Apostolic Church" },
      {
        property: "og:description",
        content: "Join Christ Cathedral Apostolic Church online for Sunday worship and the Word.",
      },
    ],
  }),
  component: LivePage,
});

function LivePage() {
  const { status, loading } = useLiveStream();
  const video = status.liveVideo ?? status.latestVideo;
  const showingReplay = !status.isLive && Boolean(status.latestVideo);

  return (
    <div className="min-h-screen bg-night text-night-foreground flex flex-col">
      <PageHero className="pt-36 pb-14 lg:pt-40">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {status.isLive ? (
            <div className="inline-flex items-center gap-2 bg-live px-3 py-1.5 text-[11px] font-semibold tracking-[0.16em] uppercase text-night-foreground">
              <span className="h-2 w-2 rounded-full bg-night-foreground animate-pulse" />
              Live Now
            </div>
          ) : (
            <div className="eyebrow text-gold">— Watch Online</div>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div>
            <h1 className="font-display text-5xl md:text-7xl leading-[0.98] max-w-4xl">
              Worship with us wherever you are.
            </h1>
            <p className="mt-6 text-lg text-night-foreground/70 leading-relaxed max-w-2xl">
              Join Christ Cathedral Apostolic Church online each Sunday for worship, the Word,
              and a life-changing encounter with Jesus Christ.
            </p>
          </div>

          <div className="border-l border-white/10 pl-6">
            <div className="eyebrow text-gold mb-2">Sunday Worship</div>
            <div className="font-display text-3xl">2:27 PM</div>
            <div className="text-sm text-night-foreground/60 mt-1">Baltimore, Maryland</div>
          </div>
        </div>
      </PageHero>

      <main className="flex-1">
        {/* Tan band, same --secondary as the homepage pillars. The page reads
            night → tan → night footer, so the player sits in the light. */}
        <section className="sand-page text-foreground">
          <div className="mx-auto max-w-7xl px-6 lg:px-10 py-16 lg:py-20">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div>
              {loading ? (
                <PlayerShell>
                  <div className="flex h-full items-center justify-center text-center px-6">
                    <div>
                      <Radio className="h-9 w-9 mx-auto text-gold animate-pulse" />
                      <div className="mt-4 eyebrow text-night-foreground/60">Checking livestream…</div>
                    </div>
                  </div>
                </PlayerShell>
              ) : video ? (
                <FacebookPlayer video={video} isLive={status.isLive} />
              ) : (
                <PlayerShell>
                  <div className="flex h-full items-center justify-center text-center px-6">
                    <div className="max-w-lg">
                      <Radio className="h-10 w-10 mx-auto text-gold" />
                      <h2 className="font-display text-3xl md:text-4xl mt-5">We’ll see you Sunday.</h2>
                      <p className="mt-4 text-night-foreground/70 leading-relaxed">
                        We’re not live right now. When service begins, the Facebook livestream will
                        appear here automatically.
                      </p>
                    </div>
                  </div>
                </PlayerShell>
              )}

              {showingReplay && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-gold-deep" />
                  Showing the most recent service while we’re offline.
                </div>
              )}

              {!status.configured && !loading && (
                <div className="mt-4 border border-gold-deep/30 bg-gold/10 px-4 py-3 text-sm text-foreground">
                  The livestream page is ready. Facebook automation will activate after the church
                  Page is connected securely.
                </div>
              )}
              </div>

              <aside className="space-y-4">
                <ActionCard
                  tone="night"
                  icon={<CalendarDays className="h-5 w-5" />}
                  eyebrow="In Person"
                  title="Plan your visit"
                  body="4005 Old York Road, Baltimore, MD. We’d love to worship with you in the room."
                  to="/plan-visit"
                  linkLabel="Plan a Visit"
                />
                <ActionCard
                  tone="light"
                  icon={<HeartHandshake className="h-5 w-5" />}
                  eyebrow="Partner"
                  title="Give online"
                  body="Support the ministry and help us continue reaching families throughout Baltimore."
                  to="/give"
                  linkLabel="Give Now"
                />
              </aside>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function PlayerShell({ children }: { children: React.ReactNode }) {
  return (
    // text-night-foreground is set here, not inherited: the shell stays dark
    // while the band around it is light, so its placeholder copy has to opt
    // back out of the section's dark-on-tan default.
    <div className="relative w-full overflow-hidden border border-foreground/10 bg-night-deep text-night-foreground aspect-video">
      {children}
    </div>
  );
}

function FacebookPlayer({ video, isLive }: { video: FacebookVideo; isLive: boolean }) {
  return (
    <div>
      <PlayerShell>
        <iframe
          title={video.title || (isLive ? "CCAC live worship service" : "CCAC worship service")}
          src={video.embedUrl}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
        />
      </PlayerShell>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {/* This caption block sits on the tan band, not on the player, so it
              takes the light-background pair: --live / --gold-deep. */}
          <div className={`eyebrow ${isLive ? "text-live" : "text-gold-deep"}`}>
            {isLive ? "Live Worship" : "Latest Service"}
          </div>
          <h2 className="font-display text-2xl md:text-3xl mt-1">
            {video.title || "Christ Cathedral Apostolic Church"}
          </h2>
          {video.description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed line-clamp-3">
              {video.description}
            </p>
          )}
        </div>

        <a
          href={video.permalinkUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-2 border border-border px-4 py-3 eyebrow text-foreground hover:border-gold-deep hover:bg-foreground/5 hover:text-gold-deep transition-colors"
        >
          Open on Facebook <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

/** Both cards sit on the tan band, so each carries its own full colour set
 *  rather than inheriting from the section: one deep-blue, one white. */
const CARD_TONES = {
  night: {
    shell: "border-night bg-night text-night-foreground",
    accent: "text-gold",
    body: "text-night-foreground/70",
    link: "text-night-foreground hover:text-gold",
  },
  light: {
    shell: "border-border bg-card text-foreground",
    accent: "text-gold-deep",
    body: "text-muted-foreground",
    link: "text-foreground hover:text-gold-deep",
  },
} as const;

function ActionCard({
  tone,
  icon,
  eyebrow,
  title,
  body,
  to,
  linkLabel,
}: {
  tone: keyof typeof CARD_TONES;
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  to: "/plan-visit" | "/give";
  linkLabel: string;
}) {
  const t = CARD_TONES[tone];
  return (
    <div className={`border p-6 ${t.shell}`}>
      <div className={t.accent}>{icon}</div>
      <div className={`eyebrow mt-5 ${t.accent}`}>{eyebrow}</div>
      <h3 className="font-display text-2xl mt-2">{title}</h3>
      <p className={`mt-3 text-sm leading-relaxed ${t.body}`}>{body}</p>
      <Link to={to} className={`inline-flex mt-6 eyebrow transition-colors ${t.link}`}>
        {linkLabel} →
      </Link>
    </div>
  );
}
