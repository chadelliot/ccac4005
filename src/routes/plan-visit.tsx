import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Clock, CalendarDays } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { SiteFooter } from "@/components/SiteFooter";
import flyer from "@/assets/plan-your-visit-flyer.webp";

export const Route = createFileRoute("/plan-visit")({
  head: () => ({
    meta: [
      { title: "Plan a Visit — Christ Cathedral Apostolic Church" },
      {
        name: "description",
        content:
          "Plan your first visit to Christ Cathedral Apostolic Church — 4005 Old York Road, Baltimore. Sunday worship at 2:27 PM.",
      },
      { property: "og:title", content: "Plan a Visit — CCAC" },
      { property: "og:description", content: "Sundays at 2:27 PM. We can't wait to meet you." },
    ],
  }),
  component: PlanVisit,
});

const SERVICES = [
  { name: "Sunday Worship Experience", time: "2:27 PM", note: "The main gathering" },
  { name: "Discipleship Class", time: "Sunday · 1:00 PM", note: "Before worship" },
  { name: "Life Class", time: "Tuesday · 7:30 PM", note: "Midweek" },
];

const EXPECT = [
  "Dynamic worship and prayer",
  "Powerful biblical teaching",
  "A welcoming and family-oriented atmosphere",
  "Opportunities for fellowship and spiritual growth",
  "Safe and engaging experiences for children and young people",
];

/**
 * Plan a Visit now carries what Find Us used to.
 *
 * The two pages answered the same question. Find Us held an address, a service
 * time and a map; Plan a Visit already had the address and the times in prose,
 * so a visitor bounced between them to assemble one answer. This runs in the
 * order someone actually needs: why come, when, where (with the map), what will
 * happen, and what to do with children.
 */
function PlanVisit() {
  return (
    <div className="sand-page text-foreground">
      <PageHero className="pt-32 pb-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-14">
          <div>
            <div className="eyebrow text-gold mb-6">— Plan a Visit</div>
            <h1 className="display-hero text-5xl lg:text-7xl">
              We can't wait
              <br />
              to meet you.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-night-foreground/70">
              Whether you are visiting for the very first time or returning after some time away,
              we want your experience to be warm, meaningful, and life-changing.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-night-foreground/80">
              <span className="inline-flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-gold" /> Sundays · 2:27 PM
              </span>
              <span className="inline-flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gold" /> 4005 Old York Road, Baltimore
              </span>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <img
              src={flyer}
              alt="Plan your visit — Christ Cathedral Apostolic Church, 4005 Old York Rd, Baltimore, MD 21218"
              width={1024}
              height={1024}
              className="w-56 sm:w-64 lg:w-80 border border-white/15 shadow-elevated"
            />
          </div>
        </div>
      </PageHero>

      {/* When */}
      <section className="py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="eyebrow text-gold-deep mb-8">— When we gather</div>
          <div className="grid gap-8 md:grid-cols-3">
            {SERVICES.map((s) => (
              <div key={s.name} className="border-l-2 border-gold-deep pl-6">
                <div className="eyebrow text-[10px] text-muted-foreground">{s.note}</div>
                <div className="font-display text-2xl mt-2">{s.name}</div>
                <div className="text-muted-foreground mt-1">{s.time}</div>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-3xl text-muted-foreground leading-relaxed">
            Special services, revival nights, and prayer gatherings are announced regularly
            through our social media.
          </p>
        </div>
      </section>

      {/* Where — the map does the work Find Us used to */}
      <section className="pb-20 lg:pb-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="eyebrow text-gold-deep mb-8">— Where to find us</div>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
            <div className="border border-border bg-card overflow-hidden">
              <iframe
                title="Map to Christ Cathedral Apostolic Church, 4005 Old York Road, Baltimore"
                src="https://www.google.com/maps?q=4005+Old+York+Road+Baltimore+MD&output=embed"
                className="w-full h-[26rem] lg:h-[30rem] border-0"
                loading="lazy"
              />
            </div>

            <div className="space-y-4">
              <InfoCard icon={<MapPin className="h-5 w-5" />} label="The address">
                4005 Old York Road
                <br />
                Baltimore, MD 21218
              </InfoCard>
              <InfoCard icon={<Clock className="h-5 w-5" />} label="Sunday worship">
                2:27 PM
                <br />
                <span className="text-sm text-muted-foreground">Doors open beforehand</span>
              </InfoCard>
              <InfoCard icon={<CalendarDays className="h-5 w-5" />} label="Parking &amp; arrival">
                <span className="text-sm text-muted-foreground leading-relaxed">
                  Arrive 15–20 minutes early so you have time to park, meet our team, and get
                  settled before service begins.
                </span>
              </InfoCard>
            </div>
          </div>
        </div>
      </section>

      {/* What happens */}
      <section className="pb-20 lg:pb-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 grid gap-12 md:grid-cols-2">
          <div className="border-l-2 border-gold-deep pl-6">
            <div className="eyebrow text-gold-deep mb-3">What to expect</div>
            <p className="text-muted-foreground leading-relaxed">
              You will be greeted by friendly people ready to help you feel comfortable and
              connected. Our worship experiences are energetic, spirit-filled, and centered
              around the Word of God.
            </p>
            <ul className="mt-4 space-y-2">
              {EXPECT.map((item) => (
                <li key={item} className="text-muted-foreground leading-relaxed">
                  <span className="text-gold-deep mr-2">—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="border-l-2 border-gold-deep pl-6">
            <div className="eyebrow text-gold-deep mb-3">For families</div>
            <p className="text-muted-foreground leading-relaxed">
              We are committed to creating an environment where children, youth, and adults can
              all grow in their relationship with God. Whether you come dressed casually or in
              your Sunday best, you are welcome here.
            </p>
          </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 text-center">
          <div className="eyebrow text-gold-deep mb-4">— Stay connected</div>
          <p className="mx-auto max-w-3xl text-muted-foreground leading-relaxed">
            After your visit, we would love to stay connected. Follow us on social media,
            introduce yourself to one of our leaders, and let us know how we can serve you and
            your family. Your next season could begin with one visit.
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function InfoCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-card p-6">
      <div className="text-gold-deep">{icon}</div>
      <div className="eyebrow text-[10px] text-muted-foreground mt-4">{label}</div>
      <div className="font-display text-xl mt-2 leading-snug">{children}</div>
    </div>
  );
}
