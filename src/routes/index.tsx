import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SocialStack } from "@/components/SocialStack";
import { SiteFooter } from "@/components/SiteFooter";
import { HeroVideo } from "@/components/HeroVideo";
import visitFlyer from "@/assets/plan-your-visit-flyer.webp";
import { RoadLines } from "@/components/RoadLines";
import communityImg from "@/assets/community-group.webp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Christ Cathedral Apostolic Church — Life Changing" },
      { name: "description", content: "A thriving ministry in Baltimore where lives are transformed by the power of Jesus Christ. Sundays at 2:27 PM." },
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
        <HeroVideo />
        <SiteHeader />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-10 pt-40 pb-32 lg:pt-48">
          {/* Two columns from lg up: the headline keeps the left, the social
              stack takes the right. Below that the stack drops under the
              buttons — at phone width a tilted card beside an 18vw headline
              leaves room for neither. */}
          <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12">
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="h-px w-10 bg-gold" />
                <div className="eyebrow text-gold">Baltimore, Maryland · The Life Center</div>
              </div>

              <p className="max-w-md text-night-foreground/80 leading-relaxed mb-12">
                A thriving ministry in the heart of Baltimore — where lives are
                transformed by the power of Jesus Christ.
              </p>

              {/* Down from 11rem: the headline now shares the row. */}
              <h1 className="display-hero text-[18vw] md:text-[12vw] lg:text-[8.5rem] xl:text-[9.5rem] leading-[0.85] text-night-foreground">
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

            <div className="flex justify-center lg:justify-end lg:pl-8">
              <SocialStack />
            </div>
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
      {/* overflow-hidden: the road art is deliberately wider than its column so
          it bleeds past the graphic, and without clipping here that widened the
          whole page. */}
      <section className="py-24 lg:py-32 overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="eyebrow text-accent mb-6">— Who We Are</div>
            <h2 className="font-display text-5xl lg:text-6xl leading-[1.05] text-foreground">
              Welcome to Christ Cathedral Apostolic Church
            </h2>
            <p className="mt-8 text-lg text-muted-foreground leading-relaxed">
              A thriving ministry in the heart of Baltimore with a passion to see lives
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
            {/* Roads sweeping in behind the graphic. Decorative, and deliberately
                sized larger than the image so it fills the surrounding white
                space rather than sitting in a neat box. */}
            <RoadLines className="absolute -inset-x-16 -inset-y-10 h-[calc(100%+5rem)] w-[calc(100%+8rem)] hidden md:block" />
            <img
              src={visitFlyer}
              alt="Plan your visit — Christ Cathedral Apostolic Church, 4005 Old York Rd, Baltimore, MD 21218"
              className="relative w-full max-w-md mx-auto border border-border shadow-elevated"
              loading="lazy"
              width={1024}
              height={1024}
            />
            {/* Light rather than the original night card: the flyer behind it is
                dark, and dark-on-dark lost the overlay entirely. Sits low-left
                so it clears the flyer's own address block. */}
            <div className="absolute -bottom-8 -left-8 hidden lg:block bg-card border border-border p-8 max-w-xs shadow-elevated">
              <div className="eyebrow text-gold-deep mb-2">Sunday Worship</div>
              <div className="font-display text-3xl">2:27 PM</div>
              <div className="text-sm text-muted-foreground mt-1">4005 Old York Road, Baltimore</div>
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
        <div className="mx-auto max-w-7xl px-6 lg:px-10 grid lg:grid-cols-5 gap-16 items-center">
          {/* Wider column than the text, and a fixed 7:5 box that matches the
              file's own aspect exactly — so object-cover never crops a side and
              nobody in the group gets cut off at any breakpoint. */}
          <img
            src={communityImg}
            alt="The Christ Cathedral Apostolic Church family"
            className="w-full aspect-[7/5] object-cover order-2 lg:order-1 lg:col-span-3"
            loading="lazy"
            width={1600}
            height={1143}
          />
          <div className="order-1 lg:order-2 lg:col-span-2">
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
        <div className="mx-auto max-w-7xl px-6 lg:px-10 text-center">
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
