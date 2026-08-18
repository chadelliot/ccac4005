import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useFeaturedEvent, useCountdown } from "@/hooks/useFeaturedEvent";

/**
 * A thin strip across the very top of the homepage carrying the next featured
 * event and its countdown.
 *
 * Sits above the hero in normal flow rather than inside it. SiteHeader is
 * absolutely positioned against the hero section, so putting this before that
 * section moves the header down with it automatically — no coordinated offset
 * between the two, and nothing to keep in sync if the bar's height changes.
 *
 * Renders nothing when there is no upcoming featured event, so the homepage is
 * unchanged the rest of the year.
 */
export function FeaturedEventBar() {
  const { event } = useFeaturedEvent();
  const remaining = useCountdown(event?.start_at);

  if (!event || !remaining || remaining.past) return null;

  const { days, hours, minutes } = remaining;

  return (
    <Link
      to="/events"
      className="group block bg-gold text-gold-foreground hover:brightness-105 transition-[filter]"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-6 py-2 text-center lg:px-10">
        <span className="eyebrow text-[10px] tracking-[0.18em] opacity-80">— Coming up</span>
        <span className="text-sm font-semibold">{event.title}</span>
        <span aria-hidden="true" className="opacity-50">·</span>
        {/* aria-label carries the spelled-out version: "12d 4h" read aloud
            character by character is not much use to a screen reader. */}
        <span
          className="text-sm tabular-nums"
          aria-label={`${days} days, ${hours} hours and ${minutes} minutes away`}
        >
          <Unit value={days} suffix="d" />
          <Unit value={hours} suffix="h" />
          <Unit value={minutes} suffix="m" />
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80 group-hover:opacity-100">
          Details
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function Unit({ value, suffix }: { value: number; suffix: string }) {
  return (
    <span className="mr-1.5 last:mr-0">
      {value}
      <span className="opacity-70">{suffix}</span>
    </span>
  );
}
