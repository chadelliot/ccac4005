import { CalendarDays, MapPin, Target, Compass } from "lucide-react";
import { useEvangelismFocus } from "@/hooks/useEvangelismFocus";
import { TerritoryMap } from "./TerritoryMap";

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
  const { territory, focus, zones, focusSource, focusWeek, assignment, loading } =
    useEvangelismFocus();

  if (loading) return <div className="eyebrow text-muted-foreground">Loading…</div>;

  const saturday = assignment?.assignment_date
    ? new Date(assignment.assignment_date + "T12:00:00")
    : null;

  const weekLabel = focusWeek
    ? new Date(focusWeek + "T12:00:00").toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <div className="eyebrow text-accent mb-3">— Evangelism</div>
        <h1 className="font-display text-5xl">This Week</h1>
      </div>

      {/* The week's focus leads, because it is the thing that changes and the
          thing the congregation is being asked to pray over.
          
          The map degrades rather than disappears: this week's area if one is
          set, last week's if not, and the standing focus area if no week has
          ever been set. An empty panel would answer "where should I go?" with
          silence, when the church always has ground it has been given. */}
      <section
        className="bg-card"
        style={{
          borderLeft: `4px solid ${
            focusSource === "territory" ? "var(--royal)" : (focus?.colour ?? "var(--royal)")
          }`,
        }}
      >
        <div className="p-6 pb-4">
          <div className="eyebrow text-muted-foreground text-[10px] flex items-center gap-1.5">
            <Target className="h-3 w-3" />
            {focusSource === "current"
              ? "— Our focus this week"
              : focusSource === "previous"
                ? "— Last week's focus area"
                : "— Our focus area"}
          </div>

          <div className="font-display text-3xl mt-1.5">
            {focusSource === "territory"
              ? (territory?.name ?? "CCAC Focus Area")
              : focus?.zone_name}
          </div>

          {focusSource === "previous" && (
            <p className="mt-2 text-sm text-muted-foreground">
              This week's area hasn't been set yet
              {weekLabel ? ` — this is where we worked the week of ${weekLabel}.` : "."} Keep at it
              here until the next one is posted.
            </p>
          )}

          {focusSource === "territory" && (
            <p className="mt-2 text-sm text-muted-foreground">
              No area has been set for this week. Take the core area in your spare time — anywhere
              inside this boundary is ground the church has claimed, and a conversation on any of
              these streets counts.
            </p>
          )}

          {focus?.note && <p className="mt-3 text-muted-foreground">{focus.note}</p>}
        </div>

        {/* Boundaries only. No pins, no counts — the shape of the work does not
            require showing anyone's address. */}
        {territory && territory.boundary.length >= 3 && (
          <TerritoryMap
            territory={territory.boundary}
            zones={focusSource === "territory" ? [] : zones}
            focusZoneId={focus?.zone_id ?? null}
            height={320}
          />
        )}
      </section>

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
