import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import bishopProfilePhoto from "@/assets/bishop-profile.webp";
import { PageHero } from "@/components/PageHero";
import { SiteFooter } from "@/components/SiteFooter";
import { getLeader, type Leader } from "@/lib/leadership";

const BISHOP_SLUG = "bishop-justin-marcus";

const BISHOP_HIGHLIGHTS = [
  { label: "Preaching Ministry", value: "Began preaching at age 11" },
  { label: "Pastoral Leadership", value: "Ordained Elder & appointed Pastor in 2011" },
  { label: "Episcopal Consecration", value: "Consecrated Bishop · July 2022" },
  { label: "District Leadership", value: "District Bishop · Greater Maryland District" },
  {
    label: "International Bible Way",
    value: "2nd Assistant Administrative Bishop · Appointed 2026",
  },
  { label: "Christ Covenant Network", value: "Founder & Presiding Bishop" },
  { label: "Education", value: "3 earned degrees + 1 honorary degree" },
  { label: "Published Works", value: "Author of 2 published works" },
];

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
  const isBishop = leader.slug === BISHOP_SLUG;

  return (
    <div className="sand-page text-foreground">
      <PageHero>
        <Link
          to="/about"
          className="eyebrow text-gold/70 hover:text-gold transition-colors"
        >
          ← Our Story
        </Link>
        <h1 className="display-hero text-5xl lg:text-7xl mt-6">
          {leader.pageName}
        </h1>
      </PageHero>

      {isBishop ? (
        <BishopProfile leader={leader} />
      ) : (
        <StandardLeaderProfile leader={leader} />
      )}

      <SiteFooter />
    </div>
  );
}

function BishopProfile({ leader }: { leader: Leader }) {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid items-center gap-10 lg:grid-cols-[360px_1fr] lg:gap-20">
          <div className="flex justify-center lg:justify-start">
            <div className="relative">
              <div
                className="absolute -inset-6 rounded-full bg-gold/10 blur-2xl"
                aria-hidden="true"
              />
              <div className="absolute -inset-3 rounded-full border border-gold-deep/25" aria-hidden="true" />
              <div className="relative h-72 w-72 overflow-hidden rounded-full border border-gold-deep/20 bg-card shadow-elevated sm:h-80 sm:w-80 lg:h-[22rem] lg:w-[22rem]">
                <img
                  src={bishopProfilePhoto}
                  alt={`${leader.name}, ${leader.role} of Christ Cathedral Apostolic Church`}
                  width={900}
                  height={900}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          <div className="max-w-3xl text-center lg:text-left">
            <div className="eyebrow text-gold-deep mb-3">{leader.role}</div>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl">
              {leader.name}
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {leader.summary}
            </p>
          </div>
        </div>

        <div className="mt-16 border-y border-border/70 py-10 lg:mt-20 lg:py-12">
          <div className="mb-8">
            <div className="eyebrow text-gold-deep mb-2">Ministry Highlights</div>
            <h3 className="font-display text-3xl sm:text-4xl">At a Glance</h3>
          </div>

          <dl className="grid sm:grid-cols-2 lg:grid-cols-4 border-t border-border/70">
            {BISHOP_HIGHLIGHTS.map((highlight) => (
              <div
                key={highlight.label}
                className="border-b border-border/70 py-5 pr-8 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-last-child(-n+4)]:border-b-0"
              >
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-deep">
                  {highlight.label}
                </dt>
                <dd className="mt-2 text-base leading-snug text-foreground">
                  {highlight.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-16 grid gap-10 lg:mt-20 lg:grid-cols-[260px_1fr] lg:gap-20">
          <div>
            <div className="eyebrow text-gold-deep mb-3">Full Biography</div>
            <h3 className="font-display text-3xl sm:text-4xl">His Ministry Story</h3>
          </div>

          <div className="max-w-2xl space-y-5">
            {leader.bio.map((paragraph, index) => (
              <p
                key={index}
                className={
                  index === 0
                    ? "text-lg leading-relaxed text-foreground"
                    : "text-muted-foreground leading-relaxed"
                }
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StandardLeaderProfile({ leader }: { leader: Leader }) {
  return (
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
            <div className="eyebrow text-gold-deep mb-3">{leader.role}</div>
            <h2 className="font-display text-4xl mb-8">{leader.name}</h2>
            <div className="space-y-4">
              {leader.bio.map((paragraph, index) => (
                <p key={index} className="text-muted-foreground leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
