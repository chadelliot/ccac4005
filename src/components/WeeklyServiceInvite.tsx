import { useEffect, useState } from "react";
import { X, Video, MapPin, CalendarDays, ArrowRight } from "lucide-react";
import { useWeeklyServices, type UpcomingService } from "@/hooks/useWeeklyServices";

/**
 * One timestamp, not a key per service.
 *
 * Dismissing quiets every invitation until the gathering that was dismissed has
 * actually happened. Tracking dismissals per service instead meant closing
 * Sunday's card immediately produced Tuesday's — whack-a-mole rather than an
 * invitation, and three gatherings would have meant three clicks.
 */
const QUIET_UNTIL_KEY = "ccac-weekly-invite-quiet-until";

/**
 * A standing invitation to the next weekly gathering.
 *
 * Deliberately not an event row. Sunday worship and Tuesday Bible study recur
 * forever, so writing them into the events table would mean a row per week
 * until the end of time; this reads the schedule and works out the next
 * occurrence instead, which is always right and never accumulates.
 *
 * Dismissing quiets it until the gathering in question has passed, after which
 * the next one brings it back. That is the "pops up every week" behaviour: it
 * returns on its own, and never nags twice for the same gathering.
 */
export function WeeklyServiceInvite() {
  const { upcoming } = useWeeklyServices();
  const [quietUntil, setQuietUntil] = useState(0);
  const [ready, setReady] = useState(false);

  // Read after mount. Prerendered HTML has no localStorage, and reading during
  // render would make the server and client markup disagree.
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(QUIET_UNTIL_KEY));
      if (Number.isFinite(stored) && stored > Date.now()) setQuietUntil(stored);
      else localStorage.removeItem(QUIET_UNTIL_KEY);
    } catch {
      // Private browsing or storage disabled: show the invitation, which is the
      // harmless direction to fail in.
    }
    setReady(true);
  }, []);

  const next = upcoming[0];
  if (!ready || !next || Date.now() < quietUntil) return null;

  const dismiss = () => {
    // Quiet until this gathering has been and gone, so the next invitation is
    // genuinely next week's rather than the one immediately behind it.
    const until = next.nextAt.getTime();
    try {
      localStorage.setItem(QUIET_UNTIL_KEY, String(until));
    } catch {
      /* Nothing to do; it will simply reappear. */
    }
    setQuietUntil(until);
  };

  return <InviteCard service={next} onDismiss={dismiss} />;
}

function InviteCard({ service, onDismiss }: { service: UpcomingService; onDismiss: () => void }) {
  const when = service.nextAt.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      role="complementary"
      aria-label={`Invitation to ${service.title}`}
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm border border-border bg-card p-5 shadow-elevated sm:left-auto sm:right-6 sm:bottom-6"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss this invitation"
        className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="eyebrow text-gold-deep mb-2 flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5" />— You're invited
      </div>
      <div className="font-display text-2xl leading-tight">{service.title}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{when}</div>

      {service.virtualNow ? (
        // The override reads first, because it is the thing that has changed
        // since last week and the whole reason someone might turn up in error.
        <div className="mt-3 border border-royal/30 bg-royal/5 p-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-royal">
            <Video className="h-3.5 w-3.5" /> Online this week
          </div>
          {service.virtual_note && (
            <p className="mt-1 text-xs text-muted-foreground">{service.virtual_note}</p>
          )}
          {service.virtual_link && (
            <a
              href={service.virtual_link}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-royal underline"
            >
              Join online <ArrowRight className="h-3 w-3" />
            </a>
          )}
        </div>
      ) : (
        <>
          {service.description && (
            <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
          )}
          {service.location && (
            <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {service.location}
            </div>
          )}
        </>
      )}
    </div>
  );
}
