import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getLeader } from "@/lib/leadership";

// `about_.` keeps the /about/<slug> path without nesting inside the About
// page's component, so each leader gets a full page of their own.
export const Route = createFileRoute("/about_/$slug")({
  loader: ({ params }) => {
    const leader = getLeader(params.slug);
    if (!leader) throw notFound();
    return leader;
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.pageName} — Christ Cathedral Apostolic Church` },
            { name: "description", content: loaderData.summary },
            { property: "og:title", content: `${loaderData.pageName} — CCAC` },
            { property: "og:description", content: loaderData.summary },
          ],
        }
      : {},
  component: LeaderPage,
});

function LeaderPage() {
  const leader = Route.useLoaderData();

  return (
    <div className="bg-background text-foreground">
      <div className="bg-night text-night-foreground pt-32 pb-24">
        <SiteHeader />
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <Link
            to="/about"
            className="eyebrow text-gold/70 hover:text-gold transition-colors"
          >
            ← Our Story
          </Link>
          <h1 className="display-hero text-5xl lg:text-7xl mt-6">
            {leader.pageName}
          </h1>
        </div>
      </div>

      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-5 lg:gap-16 items-start">
            <div className="lg:col-span-2">
              <img
                src={leader.photo}
                alt={`${leader.name}, ${leader.role} of Christ Cathedral Apostolic Church`}
                width={leader.photoWidth}
                height={leader.photoHeight}
                className="w-full h-auto object-cover"
              />
            </div>
            <div className="lg:col-span-3">
              <div className="eyebrow text-accent mb-3">{leader.role}</div>
              <h2 className="font-display text-4xl mb-8">{leader.name}</h2>
              <div className="space-y-4">
                {leader.bio.map((p, i) => (
                  <p key={i} className="text-muted-foreground leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
