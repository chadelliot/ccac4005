import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import flyer from "@/assets/plan-your-visit-flyer.webp";

export const Route = createFileRoute("/plan-visit")({
  head: () => ({
    meta: [
      { title: "Plan a Visit — Christ Cathedral Apostolic Church" },
      { name: "description", content: "Plan your first visit to Christ Cathedral Apostolic Church. Sunday worship at 2:27 PM in Baltimore." },
      { property: "og:title", content: "Plan a Visit — CCAC" },
      { property: "og:description", content: "Sundays at 2:27 PM. We can't wait to meet you." },
    ],
  }),
  component: PlanVisit,
});

const SERVICES = [
  { name: "Sunday Worship Experience", time: "2:27 PM" },
  { name: "Discipleship Class", time: "Sunday 1:00 PM" },
  { name: "Life Class", time: "Tuesday 7:30 PM" },
];

const EXPECT = [
  "Dynamic worship and prayer",
  "Powerful biblical teaching",
  "A welcoming and family-oriented atmosphere",
  "Opportunities for fellowship and spiritual growth",
  "Safe and engaging experiences for children and young people",
];

function PlanVisit() {
  return (
    <div className="bg-background text-foreground">
      <div className="bg-night text-night-foreground pt-32 pb-24">
        <SiteHeader />
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="eyebrow text-gold mb-6">— Plan a Visit</div>
          <h1 className="display-hero text-6xl lg:text-8xl">We can't wait<br />to meet you.</h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-night-foreground/70">
            Whether you are visiting for the very first time or returning after some time away,
            we want your experience to be warm, meaningful, and life-changing.
          </p>
        </div>
      </div>

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="eyebrow text-accent mb-8">— Service Times</div>
          <div className="grid gap-8 md:grid-cols-3">
            {SERVICES.map((s) => (
              <div key={s.name} className="border-l-2 border-accent pl-6">
                <div className="font-display text-2xl">{s.name}</div>
                <div className="text-muted-foreground mt-2">{s.time}</div>
              </div>
            ))}
          </div>
          <p className="mt-10 text-muted-foreground leading-relaxed">
            Special services, revival nights, and prayer gatherings are announced regularly
            through our social media platforms.
          </p>
        </div>
      </section>

      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 grid gap-12 md:grid-cols-2">
          <div className="border-l-2 border-accent pl-6">
            <div className="eyebrow text-accent mb-3">Where</div>
            <div className="font-display text-3xl">4005 Old York Road</div>
            <div className="text-muted-foreground mt-2">Baltimore, MD 21218</div>
          </div>
          <div className="border-l-2 border-accent pl-6">
            <div className="eyebrow text-accent mb-3">Parking &amp; Arrival</div>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              Arrive 15–20 minutes early so you have time to park, meet our team,
              and get settled before service begins.
            </p>
          </div>
          <div className="border-l-2 border-accent pl-6">
            <div className="eyebrow text-accent mb-3">What to expect</div>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              You will be greeted by friendly people ready to help you feel comfortable and
              connected. Our worship experiences are energetic, spirit-filled, and centered
              around the Word of God.
            </p>
            <ul className="mt-4 space-y-2">
              {EXPECT.map((item) => (
                <li key={item} className="text-muted-foreground leading-relaxed">
                  <span className="text-accent mr-2">—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="border-l-2 border-accent pl-6">
            <div className="eyebrow text-accent mb-3">For families</div>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              We are committed to creating an environment where children, youth, and adults
              can all grow in their relationship with God. Whether you come dressed casually
              or in your Sunday best, you are welcome here.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <img
            src={flyer}
            alt="Plan your visit — Christ Cathedral Apostolic Church, 4005 Old York Rd, Baltimore, MD 21218"
            className="w-full max-w-xl mx-auto"
            loading="lazy"
          />
        </div>
      </section>

      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 text-center">
          <div className="eyebrow text-accent mb-4">— Stay Connected</div>
          <p className="mx-auto max-w-3xl text-muted-foreground leading-relaxed">
            After your visit, we would love to stay connected. Follow us on social media,
            introduce yourself to one of our leaders, and let us know how we can serve you
            and your family. We cannot wait to meet you and worship with you — your next
            season could begin with one visit.
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
