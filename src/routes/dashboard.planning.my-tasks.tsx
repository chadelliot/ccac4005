import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/planning/StatusPill";
import { label, taskTone, isoDate, type TaskStatus } from "@/lib/eventPlanning";

export const Route = createFileRoute("/dashboard/planning/my-tasks")({
  head: () => ({ meta: [{ title: "My Tasks — CCAC" }] }),
  component: MyTasks,
});

type Row = {
  id: string;
  title: string;
  category: string;
  due_date: string | null;
  status: TaskStatus;
  priority: string;
  plan_id: string;
  event_plans: { title: string; starts_at: string | null } | null;
};

/**
 * Everything assigned to one person, across every event.
 *
 * Separate from the per-event task list because the question is different:
 * a planner asks "what is left on this event", a volunteer asks "what am I
 * supposed to be doing" — and answering the second by opening four events in
 * turn is how tasks get missed.
 */
function MyTasks() {
  const { user } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("event_plan_tasks")
      .select("id,title,category,due_date,status,priority,plan_id,event_plans(title,starts_at)")
      .eq("assigned_to", user.id)
      .order("due_date", { nullsFirst: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const complete = async (id: string) => {
    const { error } = await supabase
      .from("event_plan_tasks")
      .update({ status: "completed" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Task complete");
    load();
  };

  const today = isoDate(new Date());
  const open = rows.filter((r) => !["completed", "not_needed"].includes(r.status));
  const overdue = open.filter((r) => r.due_date && r.due_date < today);
  const upcoming = open.filter((r) => !r.due_date || r.due_date >= today);
  const done = rows.filter((r) => r.status === "completed");

  return (
    <div className="max-w-3xl space-y-8">
      <Link
        to="/dashboard/planning"
        className="eyebrow text-muted-foreground inline-flex items-center gap-2 hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Planning Center
      </Link>

      <div>
        <div className="eyebrow text-accent mb-2">— My tasks</div>
        <h1 className="font-display text-5xl">Assigned to you</h1>
        <p className="text-muted-foreground mt-2">
          Everything you're carrying, across every event being planned.
        </p>
      </div>

      {loading ? (
        <div className="eyebrow text-muted-foreground">Loading…</div>
      ) : open.length === 0 ? (
        <div className="border border-dashed border-border p-16 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-accent mb-4" />
          <div className="eyebrow text-muted-foreground">Nothing outstanding</div>
          <p className="text-sm text-muted-foreground mt-2">
            {done.length > 0
              ? `${done.length} task${done.length === 1 ? "" : "s"} completed.`
              : "No event tasks are assigned to you yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {overdue.length > 0 && (
            <Section
              title={`Overdue (${overdue.length})`}
              rows={overdue}
              onComplete={complete}
              today={today}
            />
          )}
          {upcoming.length > 0 && (
            <Section
              title={`Coming up (${upcoming.length})`}
              rows={upcoming}
              onComplete={complete}
              today={today}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  rows,
  onComplete,
  today,
}: {
  title: string;
  rows: Row[];
  onComplete: (id: string) => void;
  today: string;
}) {
  return (
    <div className="space-y-2">
      <div className="eyebrow text-muted-foreground text-xs">— {title}</div>
      {rows.map((r) => {
        const late = r.due_date != null && r.due_date < today;
        return (
          <div key={r.id} className="border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{r.title}</div>
                <Link
                  to="/dashboard/planning/$id"
                  params={{ id: r.plan_id }}
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  {r.event_plans?.title ?? "Event"}
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={taskTone(r.status)}>{label(r.status)}</StatusPill>
                {late && <StatusPill tone="stop">Overdue</StatusPill>}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{label(r.category)}</span>
              {r.due_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Due{" "}
                  {new Date(r.due_date + "T12:00:00").toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>

            <Button
              onClick={() => onComplete(r.id)}
              size="sm"
              className="mt-4 bg-night text-night-foreground hover:bg-night/90 rounded-none eyebrow h-8 px-3"
            >
              Mark complete
            </Button>
          </div>
        );
      })}
    </div>
  );
}
