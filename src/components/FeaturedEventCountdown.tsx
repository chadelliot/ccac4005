import { CalendarClock } from "lucide-react";
import { useFeaturedEvent, useCountdown } from "@/hooks/useFeaturedEvent";

/**
 * The full countdown that heads the events page.
 *
 * Same source as the homepage bar (useFeaturedEvent), so the two can never
 * disagree about which event is next. This one shows seconds, because it is
 * the page someone lands on to look at the event rather than a strip they pass
 * on the way somewhere else.
 */
export function FeaturedEventCountdown() {
  const { event } = useFeaturedEvent();
  const remaining = useCountdown(event?.start_at);

  if (!event || !remaining || remaining.past) return null;

  const start = new Date(event.start_at);

  return (
    <section className="border border-gold/40 bg-gold/10 p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow text-gold-deep mb-2 flex items-center gap-2">
            <CalendarClock className="h-3.5 w-3.5" />— Next up
          </div>
          <h2 className="font-display text-3xl lg:text-4xl">{event.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {start.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            {" · "}
            {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>

        <div className="flex gap-3 sm:gap-4" role="timer" aria-live="off">
          <Cell value={remaining.days} label="Days" />
          <Cell value={remaining.hours} label="Hours" />
          <Cell value={remaining.minutes} label="Minutes" />
          <Cell value={remaining.seconds} label="Seconds" />
        </div>
      </div>
    </section>
  );
}

function Cell({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-[3.75rem] border border-gold/30 bg-background/60 px-3 py-2 text-center">
      <div className="font-display text-3xl tabular-nums leading-none">
        {String(value).padStart(2, "0")}
      </div>
      <div className="eyebrow mt-1 text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}
