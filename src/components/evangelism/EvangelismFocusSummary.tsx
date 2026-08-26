import { CalendarDays, MapPin, Target, Compass } from "lucide-react";
import { useEvangelismFocus } from "@/hooks/useEvangelismFocus";

/**
 * The week's briefing, for every member.
 *
 * Read-only and map-free by design. A member needs to know where the church is
 * going on Saturday and what the week's focus is; they do not need coverage
 * metrics, contact density, or how many souls each quadrant holds. That is
 * leadership's working information, and this component simply never asks the
 * database for it — the queries are gated, not the rendering, so a member's
 * browser never receives it in the first place.
 */
export function EvangelismFocusSummary() {
  const { territory, focus, assignment, loading } = useEvangelismFocus();

  if (loading) return <div className="eyebrow text-muted-foreground">Loading…</div>;

  const saturday = assignment?.assignment_date
    ? new Date(assignment.assignment_date + "T12:00:00")
    : null;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <div className="eyebrow text-accent mb-3">— Evangelism</div>
        <h1 className="font-display text-5xl">This Week</h1>
      </div>

      {/* The week's focus leads, because it is the thing that changes and the
          thing the congregation is being asked to pray over. */}
      {focus ? (
        <section
          className="border-l-4 bg-card p-6"
          style={{ borderLeftColor: focus.colour ?? "var(--royal)" }}
        >
          <div className="eyebrow text-muted-foreground text-[10px] flex items-center gap-1.5">
            <Target className="h-3 w-3" />— Our focus
          </div>
          <div className="font-display text-3xl mt-1.5">{focus.zone_name}</div>
          {focus.note && <p className="mt-3 text-muted-foreground">{focus.note}</p>}
        </section>
      ) : (
        <section className="border border-dashed border-border p-6">
          <div className="eyebrow text-muted-foreground text-[10px]">— Our focus</div>
          <p className="mt-2 text-sm text-muted-foreground">
            This week's focus hasn't been set yet. Check back shortly.
          </p>
        </section>
      )}

      {/* Saturday's assignment: where to be, when, and what to do. */}
      <section className="border border-border bg-card p-6">
        <div className="eyebrow text-accent flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />— Saturday's assignment
        </div>

        {assignment ? (
          <>
            <div className="font-display text-2xl mt-2">
              {saturday?.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </div>
            {assignment.zone_name && (
              <div className="mt-1 text-sm text-muted-foreground">{assignment.zone_name}</div>
            )}

            {assignment.meet_at && (
              <div className="mt-4 flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Meet at</div>
                  <div className="font-medium">{assignment.meet_at}</div>
                </div>
              </div>
            )}

            {assignment.note && (
              <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
                {assignment.note}
              </p>
            )}

            {/* Stop count, not stop locations. Knowing there are six streets to
                cover is useful; the map that shows which ones is leadership's. */}
            {assignment.stop_count > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                {assignment.stop_count} {assignment.stop_count === 1 ? "stop" : "stops"} planned —
                your team lead will walk you through the route on the day.
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Saturday's assignment hasn't been posted yet.
          </p>
        )}
      </section>

      {/* The standing ground, last: it is context rather than instruction. */}
      {territory && (
        <section className="border border-border p-6">
          <div className="eyebrow text-muted-foreground text-[10px] flex items-center gap-1.5">
            <Compass className="h-3 w-3" />— Our focus area
          </div>
          <div className="font-display text-2xl mt-1.5">{territory.name}</div>
          {territory.description && (
            <p className="mt-2 text-sm text-muted-foreground">{territory.description}</p>
          )}
        </section>
      )}
    </div>
  );
}
