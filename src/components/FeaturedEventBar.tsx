import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useFeaturedEvent, useCountdown } from "@/hooks/useFeaturedEvent";

/** Only appears once the event is inside this window. */
const SHOW_WITHIN_DAYS = 14;

/**
 * A full-width strip across the very top of the homepage carrying the next
 * featured event and its countdown.
 *
 * Sits before the hero in normal flow rather than inside it. SiteHeader is
 * absolutely positioned against the hero section, so placing the bar above
 * that section moves the header down on its own — no offset shared between the
 * two, and nothing to resync if the bar's height changes.
 *
 * Held to the last fortnight: a strip across the top of the homepage reading
 * "163d" is decoration rather than urgency. The events page carries the full
 * countdown from the moment an event is featured, however far out.
 *
 * The gradient stops at --gold-deep rather than full --gold. Measured against
 * painted pixels, white text holds 9.24:1 at the purple end and 5.64:1 at the
 * gold end; full gold would be 2.04:1 and unreadable.
 */
export function FeaturedEventBar() {
  const { event } = useFeaturedEvent();
  // Only d/h/m are shown here, so a per-minute tick is enough.
  const remaining = useCountdown(event?.start_at, 60_000);

  if (!event || !remaining || remaining.past) return null;
  if (remaining.days >= SHOW_WITHIN_DAYS) return null;

  const { days, hours, minutes } = remaining;

  return (
    <Link
      to="/events"
      aria-label={`${event.title} — ${days} days, ${hours} hours and ${minutes} minutes away. See details.`}
      className="group block text-white transition-[filter] hover:brightness-110"
      style={{ backgroundImage: "linear-gradient(100deg, var(--royal), var(--gold-deep))" }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-6 py-2.5 text-center lg:px-10">
        <span className="eyebrow text-[10px] tracking-[0.18em] text-white/75">— Coming up</span>
        <span className="text-sm font-semibold">{event.title}</span>
        <span aria-hidden="true" className="text-white/40">·</span>
        <span className="text-sm tabular-nums" aria-hidden="true">
          <Unit value={days} suffix="d" />
          <Unit value={hours} suffix="h" />
          <Unit value={minutes} suffix="m" />
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75 group-hover:text-white">
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
      <span className="text-white/70">{suffix}</span>
    </span>
  );
}
