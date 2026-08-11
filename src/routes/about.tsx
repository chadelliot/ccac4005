import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LEADERS } from "@/lib/leadership";
import bishop from "@/assets/bishop-soft.webp";
import coPastor from "@/assets/copastor-soft.webp";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Christ Cathedral Apostolic Church" },
      {
        name: "description",
        content:
          "Learn about Christ Cathedral Apostolic Church, our mission, beliefs, and apostolic ministry in Baltimore.",
      },
      { property: "og:title", content: "About CCAC" },
      {
        property: "og:description",
        content: "Apostolic ministry, rooted in the Word, empowered by the Holy Ghost.",
      },
    ],
  }),
  component: AboutPage,
});

/** Matches the hero headline's container so every band lines up. */
const CONTAINER = "mx-auto max-w-7xl px-6 lg:px-10";

const PILLARS = [
  {
    eyebrow: "01 — Who We Are",
    title: "A thriving apostolic ministry",
    body: "In the heart of Baltimore, with a passion to see lives transformed by the power of Jesus Christ. We preach truth, build strong disciples, and create an atmosphere where people encounter God in a real and life-changing way.",
    className: "bg-night text-night-foreground",
    eyebrowClass: "text-gold",
  },
  {
    eyebrow: "02 — Our Mission",
    title: "Reach souls. Restore families.",
    body: "To raise up believers rooted in the Word of God and empowered by the Holy Ghost. Church is more than a service — it is a community where people from every background grow spiritually, discover purpose, and become everything God has called them to be.",
    className: "bg-royal text-night-foreground",
    eyebrowClass: "text-night-foreground/70",
  },
  {
    eyebrow: "03 — What We Believe",
    title: "The apostolic doctrine",
    body: "Repentance from sin, water baptism in the name of Jesus Christ for the remission of sins, and the infilling of the Holy Ghost with the evidence of speaking in tongues — just as the Church received on the day of Pentecost.",
    className: "bg-gold text-gold-foreground",
    eyebrowClass: "text-gold-foreground/70",
  },
];

function LeaderCard({
  to,
  pageName,
  name,
  role,
  summary,
}: {
  to: string;
  pageName: string;
  name: string;
  role: string;
  summary: string;
}) {
  return (
    <Link
      to={to}
      className="group block border-l-2 border-accent pl-6 py-1 transition-colors hover:border-gold"
    >
      <div className="eyebrow text-accent mb-2">{role}</div>
      <h3 className="font-display text-3xl lg:text-4xl group-hover:text-accent transition-colors">
        {pageName}
      </h3>
      <div className="mt-1 text-muted-foreground">{name}</div>
      <p className="mt-3 text-muted-foreground leading-relaxed">{summary}</p>
      <span className="mt-4 inline-block eyebrow text-gold">Read full bio →</span>
    </Link>
  );
}

/**
 * The two portraits bled into the right side of the page: the Bishop larger and
 * higher, First Lady Marcus smaller and lower, overlapping his left edge. Both
 * fade out top and bottom (see .leader-bleed) so nothing ends on a hard line.
 *
 * Decorative only — the cards carry the actual information, so this is hidden
 * from assistive tech and never intercepts a click.
 */
function LeadershipBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none absolute inset-y-0 right-0 hidden md:block w-[68%] max-w-[900px] overflow-hidden"
    >
      {/* width/height are the intrinsic sizes: without them these have no
          height before load, so the lazy loader sees zero area and never
          fetches them. */}
      <img
        src={bishop}
        alt=""
        width={1024}
        height={1536}
        className="leader-bleed absolute -top-[6%] -right-16 w-[32rem] lg:w-[40rem] h-auto"
        loading="lazy"
      />
      <img
        src={coPastor}
        alt=""
        width={1115}
        height={1982}
        className="leader-bleed absolute top-[30%] right-[20rem] lg:right-[27rem] w-[21rem] lg:w-[26rem] h-auto"
        loading="lazy"
      />
    </div>
  );
}

function AboutPage() {
  return (
    <div className="bg-background text-foreground">
      <div className="bg-night text-night-foreground pt-32 pb-24">
        <SiteHeader />
        <div className={CONTAINER}>
          <div className="eyebrow text-gold mb-6">— About</div>
          <h1 className="display-hero text-6xl lg:text-8xl">Our Story</h1>
        </div>
      </div>

      {/* Leadership leads the page. The backdrop spans this whole block —
          cards and invitation both — so the portraits run all the way down to
          the colour band and get clipped by it, rather than stopping short in
          empty space. */}
      <section className="relative overflow-hidden pt-24 pb-24 lg:pt-28 lg:pb-28">
        <LeadershipBackdrop />
        <div className={`relative ${CONTAINER}`}>
          <div className="eyebrow text-accent mb-12">— Our Leadership</div>
          <div className="grid gap-12 md:grid-cols-2 md:gap-10 lg:gap-16">
            {LEADERS.map((l) => (
              <LeaderCard
                key={l.slug}
                to={`/about/${l.slug}`}
                pageName={l.pageName}
                name={l.name}
                role={l.role}
                summary={l.summary}
              />
            ))}
          </div>
        </div>

        <div className={`relative ${CONTAINER}`}>
          <p className="mt-24 lg:mt-28 max-w-3xl text-muted-foreground leading-relaxed">
            Whether you are new to church, returning to your faith, or looking for a place to grow
            deeper in God, Christ Cathedral is a place where you can belong, be loved, and be
            transformed.{" "}
            <Link
              to="/plan-visit"
              className="text-accent underline underline-offset-4 hover:text-gold transition-colors"
            >
              Plan your visit
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Who we are / mission / doctrine — full-bleed band of equal thirds.
          No bottom padding: the band runs straight into the footer. */}
      <div className="grid lg:grid-cols-3">
        {PILLARS.map((p) => (
          <div
            key={p.eyebrow}
            className={`flex flex-col px-8 py-16 lg:px-12 lg:py-24 ${p.className}`}
          >
            <div className={`eyebrow mb-6 ${p.eyebrowClass}`}>{p.eyebrow}</div>
            <h2 className="font-display text-3xl lg:text-4xl leading-tight">{p.title}</h2>
            <p className="mt-5 leading-relaxed opacity-85">{p.body}</p>
          </div>
        ))}
      </div>

      <SiteFooter />
    </div>
  );
}
