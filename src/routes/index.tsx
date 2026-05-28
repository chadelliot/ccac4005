import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import heroImg from "@/assets/hero-worship.jpg";
import bibleImg from "@/assets/bible-light.jpg";
import communityImg from "@/assets/community.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Christ Cathedral Apostolic Church — Life Changing" },
      { name: "description", content: "A thriving apostolic ministry in Baltimore where lives are transformed by the power of Jesus Christ. Sundays at 2:27 PM." },
      { property: "og:title", content: "Christ Cathedral Apostolic Church" },
      { property: "og:description", content: "Life Changing. Apostolic ministry in Baltimore, MD." },
    ],
  }),
  component: HomePage,
});

const marquee = [
  "Build Families",
  "Raise Disciples",
  "Rooted in the Word",
  "Empowered by the Holy Ghost",
  "Sunday Worship · 2:27 PM",
  "4005 Old York Road · Baltimore MD",
  "Reach Souls",
];

function HomePage() {
  return (
    <div className="bg-background text-foreground">
      {/* HERO */}
      <section className="relative min-h-screen overflow-hidden bg-night text-night-foreground">
        <img
          src={heroImg}
          alt="Worship at Christ Cathedral Apostolic Church"
          className="absolute inset-0 h-full w-full object-cover"
          width={1920}
          height={1280}
        />
        <div className="absolute inset-0 hero-overlay" />
        <SiteHeader />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-10 pt-40 pb-32 lg:pt-48">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px w-10 bg-gold" />
            <div className="eyebrow text-gold">Baltimore, Maryland · Apostolic Ministry</div>
          </div>

          <p className="max-w-md text-night-foreground/80 leading-relaxed mb-12">
            A thriving ministry in the heart of Baltimore — where lives are
            transformed by the power of Jesus Christ.
          </p>

          <h1 className="display-hero text-[18vw] md:text-[12vw] lg:text-[11rem] text-night-foreground">
            Life
            <br />
            Changing
          </h1>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link
              to="/plan-visit"
              className="inline-flex items-center bg-night-foreground text-night px-8 py-4 eyebrow hover:bg-white/90"
            >
              Plan Your Visit
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center border border-white/30 text-night-foreground px-8 py-4 eyebrow hover:bg-white/10"
            >
              Our Story
            </Link>
          </div>
        </div>

        {/* Scrolling marquee */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-night/60 backdrop-blur overflow-hidden">
          <div className="flex animate-[scroll_40s_linear_infinite] whitespace-nowrap py-4">
            {[...marquee, ...marquee, ...marquee].map((m, i) => (
              <span key={i} className="eyebrow text-night-foreground/60 px-8 flex items-center gap-8">
                {m}
                <span className="h-1 w-1 rounded-full bg-gold" />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* WELCOME */}
      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="eyebrow text-accent mb-6">— Who We Are</div>
            <h2 className="font-display text-5xl lg:text-6xl leading-[1.05] text-foreground">
              Welcome to Christ Cathedral Apostolic Church
            </h2>
            <p className="mt-8 text-lg text-muted-foreground leading-relaxed">
              A thriving apostolic ministry in the heart of Baltimore with a passion to see lives
              transformed by the power of Jesus Christ. We are committed to preaching truth,
              building strong disciples, and creating an atmosphere where people can encounter
              God in a real and life-changing way.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/about" className="inline-flex items-center bg-night px-8 py-4 eyebrow text-night-foreground hover:bg-night/90">
                Our Story
              </Link>
              <Link to="/plan-visit" className="inline-flex items-center border border-night/20 px-8 py-4 eyebrow hover:bg-night hover:text-night-foreground">
                Plan a Visit
              </Link>
            </div>
          </div>
          <div className="relative">
            <img src={bibleImg} alt="Open Bible by warm lamplight" className="w-full h-[500px] object-cover" loading="lazy" width={1280} height={896} />
            <div className="absolute -bottom-8 -left-8 bg-night text-night-foreground p-8 max-w-xs hidden lg:block">
              <div className="eyebrow text-gold mb-2">Sunday Worship</div>
              <div className="font-display text-3xl">2:27 PM</div>
              <div className="text-sm text-night-foreground/70 mt-1">4005 Old York Road, Baltimore</div>
            </div>
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section className="py-24 bg-secondary">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="eyebrow text-accent mb-4">— Our Pillars</div>
          <h2 className="font-display text-5xl lg:text-6xl max-w-3xl">What we are committed to.</h2>
          <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { n: "01", t: "Build Families", d: "Strong homes built on the rock of Christ." },
              { n: "02", t: "Raise Disciples", d: "Equipping believers to walk in maturity." },
              { n: "03", t: "Reach Souls", d: "Carrying the gospel into our community." },
              { n: "04", t: "Empower by the Spirit", d: "Lives transformed by the Holy Ghost." },
            ].map((p) => (
              <div key={p.n} className="border-t border-night/20 pt-6">
                <div className="eyebrow text-accent mb-4">{p.n}</div>
                <div className="font-display text-2xl mb-3">{p.t}</div>
                <p className="text-muted-foreground text-sm leading-relaxed">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMUNITY */}
      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 grid lg:grid-cols-2 gap-16 items-center">
          <img src={communityImg} alt="The CCAC community" className="w-full h-[500px] object-cover order-2 lg:order-1" loading="lazy" width={1280} height={896} />
          <div className="order-1 lg:order-2">
            <div className="eyebrow text-accent mb-6">— Family</div>
            <h2 className="font-display text-5xl lg:text-6xl leading-[1.05]">You belong here.</h2>
            <p className="mt-8 text-lg text-muted-foreground leading-relaxed">
              Whether you're seeking, returning, or coming home — there's a seat for you.
              Join us this Sunday and experience worship, the Word, and a family ready to walk with you.
            </p>
            <Link to="/plan-visit" className="inline-flex items-center mt-10 bg-night px-8 py-4 eyebrow text-night-foreground hover:bg-night/90">
              I'm Coming This Sunday
            </Link>
          </div>
        </div>
      </section>

      {/* GIVE CTA */}
      <section className="py-24 bg-night text-night-foreground">
        <div className="mx-auto max-w-4xl px-6 lg:px-10 text-center">
          <div className="eyebrow text-gold mb-6">— Partner With Us</div>
          <h2 className="font-display text-5xl lg:text-7xl">Give Online</h2>
          <p className="mt-8 text-night-foreground/70 text-lg leading-relaxed max-w-2xl mx-auto">
            Every seed sown helps us reach souls, raise disciples, and build the Kingdom right here in Baltimore.
          </p>
          <Link
            to="/give"
            className="inline-flex items-center mt-10 bg-gold text-gold-foreground px-10 py-5 eyebrow hover:bg-gold/90"
          >
            Give Now
          </Link>
          <div className="mt-4 text-xs eyebrow text-night-foreground/50">
            PayPal · Cash App · Zelle
          </div>
        </div>
      </section>

      <SiteFooter />

      <style>{`
        @keyframes scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}
