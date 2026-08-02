import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LEADERS } from "@/lib/leadership";
import bishop from "@/assets/bishop-justin-marcus.webp";
import coPastor from "@/assets/copastor-brandi-marcus.webp";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Christ Cathedral Apostolic Church" },
      { name: "description", content: "Learn about Christ Cathedral Apostolic Church, our mission, beliefs, and apostolic ministry in Baltimore." },
      { property: "og:title", content: "About CCAC" },
      { property: "og:description", content: "Apostolic ministry, rooted in the Word, empowered by the Holy Ghost." },
    ],
  }),
  component: AboutPage,
});

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
      <h3 className="font-display text-3xl group-hover:text-accent transition-colors">
        {pageName}
      </h3>
      <div className="mt-1 text-muted-foreground">{name}</div>
      <p className="mt-3 max-w-xl text-muted-foreground leading-relaxed">
        {summary}
      </p>
      <span className="mt-4 inline-block eyebrow text-gold">
        Read full bio →
      </span>
    </Link>
  );
}

/**
 * The two portraits, overlapped and bled off the right edge at 7% opacity.
 * Decorative only — the bios carry the actual information, so this is hidden
 * from assistive tech and never intercepts a click.
 */
function LeadershipBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none absolute inset-y-0 right-0 hidden md:block w-[62%] max-w-[820px] overflow-hidden"
    >
      {/* width/height are the intrinsic sizes: without them these have no
          height before load, so the lazy loader sees zero area and never
          fetches them. */}
      <img
        src={coPastor}
        alt=""
        width={1115}
        height={1982}
        className="leader-bleed absolute -right-24 top-[6%] w-[26rem] lg:w-[32rem] h-auto"
        loading="lazy"
      />
      <img
        src={bishop}
        alt=""
        width={1024}
        height={1536}
        className="leader-bleed absolute right-40 lg:right-56 top-[30%] w-[24rem] lg:w-[30rem] h-auto"
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
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="eyebrow text-gold mb-6">— About</div>
          <h1 className="display-hero text-6xl lg:text-8xl">Our Story</h1>
        </div>
      </div>

      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-6 lg:px-10">
          <p className="text-xl leading-relaxed text-muted-foreground">
            Christ Cathedral Apostolic Church is a thriving apostolic ministry in the heart of
            Baltimore with a passion to see lives transformed by the power of Jesus Christ. We are
            committed to preaching truth, building strong disciples, and creating an atmosphere
            where people can encounter God in a real and life-changing way.
          </p>

          <h2 className="font-display text-4xl mt-16 mb-6">Our Mission</h2>
          <p className="text-muted-foreground leading-relaxed">
            To reach souls, restore families, and raise up believers who are rooted in the Word of
            God and empowered by the Holy Ghost. We believe that church is more than a service — it
            is a community of faith where people from every background can grow spiritually,
            discover purpose, and become everything God has called them to be.
          </p>

          <h2 className="font-display text-4xl mt-16 mb-6">What We Believe</h2>
          <p className="text-muted-foreground leading-relaxed">
            We hold to the apostolic doctrine — repentance from sin, water baptism in the name of
            Jesus Christ for the remission of sins, and the infilling of the Holy Ghost with the
            evidence of speaking in tongues, just as the Church received on the day of Pentecost.
          </p>

          <p className="text-muted-foreground leading-relaxed mt-8">
            Whether you are new to church, returning to your faith, or looking for a place to grow
            deeper in God, Christ Cathedral is a place where you can belong, be loved, and be
            transformed.
          </p>
        </div>
      </section>

      <section className="relative overflow-hidden pb-24 lg:pb-32">
        <LeadershipBackdrop />
        <div className="relative mx-auto max-w-6xl px-6 lg:px-10">
          <div className="eyebrow text-accent mb-12">— Our Leadership</div>
          <div className="space-y-14">
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
      </section>

      <SiteFooter />
    </div>
  );
}
