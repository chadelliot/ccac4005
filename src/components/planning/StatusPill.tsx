import type { ReactNode } from "react";
import { TONE_CLASS, type Tone } from "@/lib/eventPlanning";

/**
 * A status, readable without colour.
 *
 * Every pill carries its word. Colour is a second signal for people who can use
 * it, never the only one — a planner who cannot separate the amber from the
 * grey still reads "Revisions requested", and the same pill photographs and
 * prints legibly.
 */
export function StatusPill({
  tone,
  children,
  icon,
  className = "",
}: {
  tone: Tone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`eyebrow inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] whitespace-nowrap ${TONE_CLASS[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * Task progress as a bar plus the count in words.
 *
 * The number is not decoration: a bar alone cannot distinguish 0 of 0 from
 * 0 of 40, and those mean very different things three weeks out.
 */
export function TaskProgress({
  done,
  total,
  overdue,
}: {
  done: number;
  total: number;
  overdue: number;
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="min-w-[7rem]">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="tabular-nums">
          {done}/{total}
        </span>
        {overdue > 0 && <span className="text-destructive tabular-nums">{overdue} overdue</span>}
      </div>
      <div
        className="mt-1 h-1.5 w-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${done} of ${total} tasks complete`}
      >
        <div
          className={`h-full ${overdue > 0 ? "bg-destructive/70" : "bg-accent"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
