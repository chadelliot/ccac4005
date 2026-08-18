import { useFeaturedEvent, useCountdown } from "@/hooks/useFeaturedEvent";

/**
 * Large countdown digits that sit beside the "Upcoming Events" heading.
 *
 * No panel, no background of its own — it belongs to the page hero and takes
 * that hero's colours, so the top of the events page stays one composition
 * rather than a heading followed by a separate banner competing with it.
 *
 * No distance limit, unlike the header chip: this is the page people open to
 * find out what is coming, so an event months out is still worth counting.
 */
export function EventsHeroCountdown() {
  const { event } = useFeaturedEvent();
  const remaining = useCountdown(event?.start_at);

  if (!event || !remaining || remaining.past) return null;

  return (
    // aria-live is off deliberately: this reads out every second otherwise,
    // which would make the page unusable with a screen reader. The event name
    // and date in the heading area already carry the meaning.
    <div role="timer" aria-live="off" className="shrink-0">
      <div className="eyebrow text-gold mb-3">— {event.title}</div>
      <div className="flex gap-5 sm:gap-7">
        <Cell value={remaining.days} label="Days" />
        <Cell value={remaining.hours} label="Hours" />
        <Cell value={remaining.minutes} label="Minutes" />
        <Cell value={remaining.seconds} label="Seconds" />
      </div>
    </div>
  );
}

function Cell({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-5xl leading-none tabular-nums sm:text-6xl lg:text-7xl">
        {String(value).padStart(2, "0")}
      </div>
      <div className="eyebrow mt-2 text-[9px] text-night-foreground/60">{label}</div>
    </div>
  );
}
