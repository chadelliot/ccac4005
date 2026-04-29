import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

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
        <div className="mx-auto max-w-3xl px-6 lg:px-10 prose prose-lg">
          <p className="text-xl leading-relaxed text-muted-foreground">
            Christ Cathedral Apostolic Church is a thriving apostolic ministry in the heart of Baltimore, Maryland.
            We are committed to preaching the truth of God's Word, walking in the power of the Holy Ghost,
            and seeing lives transformed by the gospel of Jesus Christ.
          </p>
          <h2 className="font-display text-4xl mt-16 mb-6">What We Believe</h2>
          <p className="text-muted-foreground leading-relaxed">
            We hold to the apostolic doctrine — repentance from sin, water baptism in the name of
            Jesus Christ for the remission of sins, and the infilling of the Holy Ghost with the
            evidence of speaking in tongues, just as the Church received on the day of Pentecost.
          </p>
          <h2 className="font-display text-4xl mt-16 mb-6">Our Mission</h2>
          <p className="text-muted-foreground leading-relaxed">
            To build families, raise disciples, reach souls, and empower every believer to walk
            in the fullness of God's purpose for their life.
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
