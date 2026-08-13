import { SiteHeader } from "@/components/SiteHeader";

/**
 * The standard dark page header: --night with the royal bloom and gold
 * spotlight of .brand-wash behind it.
 *
 * Every public page uses this except the homepage, which has the hero video,
 * and Give, which is light by design.
 *
 * SiteHeader lives inside so it is guaranteed to sit above the wash (it is
 * absolutely positioned and carries z-40, the wash has no z-index), and so a
 * page can never accidentally pair a dark hero with the light-tone header.
 */
export function PageHero({
  children,
  className = "pt-32 pb-24",
}: {
  children: React.ReactNode;
  /** Vertical rhythm for the inner container. Must keep enough top padding to
   *  clear the absolute header — pt-32 is the floor. */
  className?: string;
}) {
  return (
    <div className="relative bg-night text-night-foreground">
      <div aria-hidden="true" className="brand-wash pointer-events-none absolute inset-0" />
      <SiteHeader />
      <div className={`relative mx-auto max-w-7xl px-6 lg:px-10 ${className}`}>{children}</div>
    </div>
  );
}
