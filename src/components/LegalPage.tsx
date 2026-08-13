import { PageHero } from "@/components/PageHero";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * Shared shell for the privacy policy and terms pages.
 *
 * Deliberately narrower than the rest of the site (max-w-3xl rather than
 * max-w-7xl): these are read as prose, and a 7xl measure at this font size runs
 * well past the line length anyone can comfortably track.
 */
export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  /** ISO date. Rendered long-form; kept as a constant per page so it only
   *  changes when the text actually does. */
  updated: string;
  children: React.ReactNode;
}) {
  const updatedLabel = (() => {
    const [y, m, d] = updated.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  })();

  return (
    <div className="min-h-screen sand-page text-foreground flex flex-col">
      <PageHero className="pt-32 pb-20">
        <div className="eyebrow text-gold mb-6">— {eyebrow}</div>
        <h1 className="display-hero text-5xl lg:text-7xl">{title}</h1>
        <p className="mt-6 text-night-foreground/60 text-sm">Last updated {updatedLabel}</p>
      </PageHero>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 lg:px-10 py-16 lg:py-20">
          <div className="legal-prose">{children}</div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="font-display text-2xl lg:text-3xl">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
