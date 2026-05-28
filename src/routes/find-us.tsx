import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MapPin, Clock, Phone } from "lucide-react";

export const Route = createFileRoute("/find-us")({
  head: () => ({
    meta: [
      { title: "Find Us — Christ Cathedral Apostolic Church" },
      { name: "description", content: "Directions and contact info for Christ Cathedral Apostolic Church in Baltimore, MD." },
      { property: "og:title", content: "Find Us — CCAC" },
      { property: "og:description", content: "4005 Old York Road, Baltimore, MD." },
    ],
  }),
  component: FindUs,
});

function FindUs() {
  return (
    <div className="bg-background text-foreground">
      <div className="bg-night text-night-foreground pt-32 pb-24">
        <SiteHeader />
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="eyebrow text-gold mb-6">— Find Us</div>
          <h1 className="display-hero text-6xl lg:text-8xl">Come visit.</h1>
        </div>
      </div>

      <section className="py-24">
        <div className="mx-auto max-w-5xl px-6 lg:px-10 grid md:grid-cols-3 gap-8">
          <div className="border border-border p-8">
            <MapPin className="h-6 w-6 text-accent mb-4" />
            <div className="eyebrow text-muted-foreground mb-2">Address</div>
            <div className="font-display text-xl">4005 Old York Road<br />Baltimore, MD</div>
          </div>
          <div className="border border-border p-8">
            <Clock className="h-6 w-6 text-accent mb-4" />
            <div className="eyebrow text-muted-foreground mb-2">Service</div>
            <div className="font-display text-xl">Sundays<br />2:27 PM</div>
          </div>
          <div className="border border-border p-8">
            <Phone className="h-6 w-6 text-accent mb-4" />
            <div className="eyebrow text-muted-foreground mb-2">Contact</div>
            <Link to="/give" className="font-display text-xl hover:text-accent">Give Online →</Link>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-6 lg:px-10 mt-12">
          <iframe
            title="Map"
            src="https://www.google.com/maps?q=4005+Old+York+Road+Baltimore+MD&output=embed"
            className="w-full h-96 border border-border"
            loading="lazy"
          />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
