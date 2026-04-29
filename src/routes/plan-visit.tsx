import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

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

function PlanVisit() {
  return (
    <div className="bg-background text-foreground">
      <div className="bg-night text-night-foreground pt-32 pb-24">
        <SiteHeader />
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="eyebrow text-gold mb-6">— Plan a Visit</div>
          <h1 className="display-hero text-6xl lg:text-8xl">We can't wait<br />to meet you.</h1>
        </div>
      </div>

      <section className="py-24">
        <div className="mx-auto max-w-5xl px-6 lg:px-10 grid md:grid-cols-2 gap-12">
          <div className="border-l-2 border-accent pl-6">
            <div className="eyebrow text-accent mb-3">When</div>
            <div className="font-display text-3xl">Sunday Worship</div>
            <div className="text-muted-foreground mt-2">2:27 PM</div>
          </div>
          <div className="border-l-2 border-accent pl-6">
            <div className="eyebrow text-accent mb-3">Where</div>
            <div className="font-display text-3xl">4005 Old York Road</div>
            <div className="text-muted-foreground mt-2">Baltimore, MD</div>
          </div>
          <div className="border-l-2 border-accent pl-6">
            <div className="eyebrow text-accent mb-3">What to expect</div>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              Anointed worship, the preached Word, and a family eager to welcome you. Come as you are.
            </p>
          </div>
          <div className="border-l-2 border-accent pl-6">
            <div className="eyebrow text-accent mb-3">Dress code</div>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              No dress code — wear what makes you comfortable. The atmosphere is reverent and warm.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
