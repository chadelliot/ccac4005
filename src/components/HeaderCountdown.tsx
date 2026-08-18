import { Link } from "@tanstack/react-router";
import { useFeaturedEvent, useCountdown } from "@/hooks/useFeaturedEvent";

/** Only appears once the event is inside this window. */
const SHOW_WITHIN_DAYS = 14;

/**
 * A compact countdown that lives in the header itself, to the right, with the
 * event name beneath it, linking to the events page.
 *
 * Held to the last fortnight on purpose: the header is prime real estate on
 * every page, and a counter reading "163d" is noise rather than urgency. The
 * events page carries the full countdown from the moment an event is featured,
 * however far out it is, so nothing is hidden — this is only the nudge.
 *
 * The gradient runs to --gold-deep rather than --gold. White text on full gold
 * measures about 1.6:1, which is unreadable; --gold-deep still reads as gold
 * against the purple and holds legible contrast across the whole sweep.
 */
// No tone prop: the chip carries its own gradient background, so it reads the
// same over the dark header and the light one.
export function HeaderCountdown() {
  const { event } = useFeaturedEvent();
  const remaining = useCountdown(event?.start_at);

  if (!event || !remaining || remaining.past) return null;
  if (remaining.days >= SHOW_WITHIN_DAYS) return null;

  const { days, hours, minutes } = remaining;

  return (
    <Link
      to="/events"
      aria-label={`${event.title} — ${days} days, ${hours} hours and ${minutes} minutes away. See details.`}
      className="group hidden sm:block rounded-sm px-3 py-1.5 text-white shadow-elevated transition-transform hover:-translate-y-0.5"
      style={{ backgroundImage: "linear-gradient(100deg, var(--royal), var(--gold-deep))" }}
    >
      <div className="flex items-baseline justify-center gap-1 text-sm font-semibold tabular-nums leading-none">
        <span>{days}<span className="opacity-70">d</span></span>
        <span>{String(hours).padStart(2, "0")}<span className="opacity-70">h</span></span>
        <span>{String(minutes).padStart(2, "0")}<span className="opacity-70">m</span></span>
      </div>
      {/* Truncated rather than wrapped: a long event title must not be allowed
          to change the height of the header row. */}
      <div className="mt-0.5 max-w-[13rem] truncate text-center text-[10px] uppercase tracking-[0.12em] opacity-90 group-hover:opacity-100">
        {event.title}
      </div>
    </Link>
  );
}
