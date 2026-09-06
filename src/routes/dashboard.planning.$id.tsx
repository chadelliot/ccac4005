import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Send,
  Check,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useCapabilities } from "@/lib/adminCapabilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusPill, TaskProgress } from "@/components/planning/StatusPill";
import {
  label,
  planningTone,
  approvalTone,
  taskTone,
  taskProgress,
  isoDate,
  TASK_CATEGORIES,
  TASK_STATUSES,
  PLANNING_STATUSES,
  MODULES,
  type PlanningStatus,
  type ApprovalStatus,
  type TaskStatus,
} from "@/lib/eventPlanning";

export const Route = createFileRoute("/dashboard/planning/$id")({
  head: () => ({ meta: [{ title: "Event Plan — CCAC" }] }),
  component: PlanWorkspace,
});

type Plan = {
  id: string;
  title: string;
  purpose: string | null;
  desired_outcome: string | null;
  theme: string | null;
  scripture: string | null;
  group_id: string | null;
  owner_id: string | null;
  supporting_team: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  venue_kind: string;
  audience: string | null;
  attendance_goal: number | null;
  visibility: string;
  registration_required: boolean;
  budget_estimate_cents: number | null;
  planning_status: PlanningStatus;
  approval_status: ApprovalStatus;
  created_by: string;
};

type Task = {
  id: string;
  title: string;
  category: string;
  assigned_to: string | null;
  due_date: string | null;
  status: TaskStatus;
  priority: string;
  sort_order: number;
};

type Approval = {
  id: string;
  action: string;
  actor_id: string | null;
  notes: string | null;
  created_at: string;
};

function PlanWorkspace() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const { has } = useCapabilities(user);
  const canReview = has("events_review");
  const navigate = useNavigate();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [people, setPeople] = useState<{ id: string; display_name: string | null }[]>([]);
  const [groups, setGroups] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  const load = useCallback(async () => {
    const [{ data: p }, { data: t }, { data: m }, { data: a }, { data: prof }, { data: g }] =
      await Promise.all([
        supabase.from("event_plans").select("*").eq("id", id).maybeSingle(),
        supabase.from("event_plan_tasks").select("*").eq("plan_id", id).order("sort_order"),
        supabase.from("event_plan_modules").select("module_key").eq("plan_id", id),
        supabase
          .from("event_plan_approvals")
          .select("*")
          .eq("plan_id", id)
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("id,display_name").order("display_name"),
        supabase.from("groups").select("id,name"),
      ]);
    setPlan((p as Plan | null) ?? null);
    setTasks((t ?? []) as Task[]);
    setModules(((m ?? []) as { module_key: string }[]).map((x) => x.module_key));
    setApprovals((a ?? []) as Approval[]);
    setPeople((prof ?? []) as { id: string; display_name: string | null }[]);
    setGroups(
      Object.fromEntries(((g ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name])),
    );
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="eyebrow text-muted-foreground">Loading…</div>;
  if (!plan) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="eyebrow text-muted-foreground">Not found</div>
        <p className="text-sm text-muted-foreground">
          This plan doesn't exist, or you don't have access to it.
        </p>
        <Link
          to="/dashboard/planning"
          className="eyebrow inline-flex items-center gap-2 hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Planning Center
        </Link>
      </div>
    );
  }

  const canEdit = canReview || plan.owner_id === user?.id || plan.created_by === user?.id;
  const progress = taskProgress(tasks);
  const today = isoDate(new Date());

  const patchPlan = async (patch: Partial<Plan>) => {
    const { error } = await supabase.from("event_plans").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    setPlan({ ...plan, ...patch });
  };

  const patchTask = async (taskId: string, patch: Partial<Task>) => {
    const { error } = await supabase.from("event_plan_tasks").update(patch).eq("id", taskId);
    if (error) return toast.error(error.message);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
  };

  const addTask = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("event_plan_tasks")
      .insert({ plan_id: id, title: "New task", sort_order: tasks.length, created_by: user.id })
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    setTasks([...tasks, data as Task]);
  };

  const removeTask = async (taskId: string) => {
    const { error } = await supabase.from("event_plan_tasks").delete().eq("id", taskId);
    if (error) return toast.error(error.message);
    setTasks(tasks.filter((t) => t.id !== taskId));
  };

  /** Submitting and deciding both write history and move the status together. */
  const recordApproval = async (action: string, nextStatus: ApprovalStatus) => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("event_plan_approvals")
      .insert({ plan_id: id, action, actor_id: user.id, notes: reviewNote.trim() || null });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    await patchPlan({ approval_status: nextStatus });
    setReviewNote("");
    setBusy(false);
    load();
    toast.success(label(nextStatus));
  };

  // Readiness: warn, never silently block.
  const blockers: string[] = [];
  if (!plan.owner_id) blockers.push("No event owner assigned");
  if (plan.approval_status !== "approved") blockers.push("Leadership approval outstanding");
  if (progress.overdue > 0)
    blockers.push(`${progress.overdue} task${progress.overdue === 1 ? "" : "s"} overdue`);
  if (modules.includes("outdoor") && !tasks.some((t) => /weather/i.test(t.title)))
    blockers.push("Outdoor event without a weather contingency task");
  if (modules.includes("children_youth") && !tasks.some((t) => /supervis/i.test(t.title)))
    blockers.push("Children's event without supervision confirmed");

  return (
    <div className="max-w-5xl space-y-8">
      <Link
        to="/dashboard/planning"
        className="eyebrow text-muted-foreground inline-flex items-center gap-2 hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Planning Center
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow text-accent mb-2">— Event plan</div>
          <h1 className="font-display text-5xl">{plan.title}</h1>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {plan.starts_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(plan.starts_at).toLocaleString("en-US", {
                  timeZone: "America/New_York",
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
            {plan.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {plan.location}
              </span>
            )}
            {plan.group_id && groups[plan.group_id] && (
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {groups[plan.group_id]}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={planningTone(plan.planning_status)}>
            {label(plan.planning_status)}
          </StatusPill>
          <StatusPill tone={approvalTone(plan.approval_status)}>
            {label(plan.approval_status)}
          </StatusPill>
        </div>
      </div>

      {/* Readiness — explained, never a silent block. */}
      {blockers.length > 0 && (
        <div className="border border-gold/60 bg-gold/10 p-5">
          <div className="eyebrow text-gold-deep flex items-center gap-1.5 text-[10px]">
            <AlertCircle className="h-3 w-3" />— Before this is ready
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {blockers.map((b) => (
              <li key={b}>• {b}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="min-w-0 space-y-8">
          {/* --------------------------------------------------------- Tasks */}
          <section className="border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
              <div>
                <div className="eyebrow text-accent">— Tasks</div>
                <div className="mt-1">
                  <TaskProgress
                    done={progress.done}
                    total={progress.total}
                    overdue={progress.overdue}
                  />
                </div>
              </div>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addTask}
                  className="rounded-none eyebrow"
                >
                  <Plus className="h-3.5 w-3.5" /> Add task
                </Button>
              )}
            </div>

            {tasks.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                No tasks yet. Add the first one above.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {tasks.map((t) => {
                  const late = t.due_date != null && t.due_date < today && t.status !== "completed";
                  const mine = t.assigned_to === user?.id;
                  return (
                    <li key={t.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {canEdit ? (
                            <Input
                              value={t.title}
                              aria-label="Task name"
                              onChange={(e) =>
                                setTasks((p) =>
                                  p.map((x) =>
                                    x.id === t.id ? { ...x, title: e.target.value } : x,
                                  ),
                                )
                              }
                              onBlur={(e) => patchTask(t.id, { title: e.target.value })}
                              className="border-transparent px-0 focus:border-border focus:px-2"
                            />
                          ) : (
                            <div className="text-sm">{t.title}</div>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{label(t.category)}</span>
                            {late && <StatusPill tone="stop">Overdue</StatusPill>}
                            {mine && <StatusPill tone="progress">Yours</StatusPill>}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={t.status}
                            onValueChange={(v) => patchTask(t.id, { status: v as TaskStatus })}
                          >
                            <SelectTrigger
                              className="h-8 w-[10rem] text-xs"
                              aria-label="Task status"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TASK_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {label(s)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {canEdit && (
                            <>
                              <Select
                                value={t.assigned_to ?? "none"}
                                onValueChange={(v) =>
                                  patchTask(t.id, { assigned_to: v === "none" ? null : v })
                                }
                              >
                                <SelectTrigger
                                  className="h-8 w-[10rem] text-xs"
                                  aria-label="Assigned to"
                                >
                                  <SelectValue placeholder="Unassigned" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Unassigned</SelectItem>
                                  {people.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.display_name ?? "Unnamed"}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="date"
                                value={t.due_date ?? ""}
                                aria-label="Due date"
                                onChange={(e) =>
                                  patchTask(t.id, { due_date: e.target.value || null })
                                }
                                className="h-8 w-[9rem] text-xs"
                              />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Remove ${t.title}`}
                                    className="h-8 text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove this task?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      "{t.title}" will be deleted from this plan. This cannot be
                                      undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => removeTask(t.id)}>
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ------------------------------------------------------ Overview */}
          <section className="border border-border bg-card p-6 space-y-5">
            <div className="eyebrow text-accent">— Overview</div>
            {plan.purpose && <Field label="Purpose">{plan.purpose}</Field>}
            {plan.desired_outcome && <Field label="Desired outcome">{plan.desired_outcome}</Field>}
            <div className="grid gap-5 sm:grid-cols-2">
              {plan.theme && <Field label="Theme">{plan.theme}</Field>}
              {plan.scripture && <Field label="Scripture">{plan.scripture}</Field>}
              {plan.audience && <Field label="Audience">{plan.audience}</Field>}
              {plan.attendance_goal != null && (
                <Field label="Attendance goal">{plan.attendance_goal}</Field>
              )}
              <Field label="Venue">{label(plan.venue_kind)}</Field>
              <Field label="Open to">{label(plan.visibility)}</Field>
              {plan.supporting_team && (
                <Field label="Supporting team">{plan.supporting_team}</Field>
              )}
              {plan.budget_estimate_cents != null && (
                <Field label="Budget estimate">
                  ${(plan.budget_estimate_cents / 100).toLocaleString()}
                </Field>
              )}
            </div>
          </section>
        </div>

        {/* ------------------------------------------------------------ Side */}
        <aside className="space-y-6 lg:sticky lg:top-6">
          {canEdit && (
            <section className="border border-border bg-card p-5 space-y-3">
              <div className="eyebrow text-accent text-[10px]">— Planning status</div>
              <Select
                value={plan.planning_status}
                onValueChange={(v) => patchPlan({ planning_status: v as PlanningStatus })}
              >
                <SelectTrigger aria-label="Planning status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLANNING_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {label(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div>
                <Label className="text-xs">Owner</Label>
                <Select
                  value={plan.owner_id ?? "none"}
                  onValueChange={(v) => patchPlan({ owner_id: v === "none" ? null : v })}
                >
                  <SelectTrigger aria-label="Event owner">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not assigned</SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.display_name ?? "Unnamed"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>
          )}

          {/* Submission and review */}
          <section className="border border-border bg-card p-5 space-y-3">
            <div className="eyebrow text-accent text-[10px]">— Approval</div>

            {canEdit && ["not_submitted", "revisions_requested"].includes(plan.approval_status) && (
              <Button
                onClick={() => recordApproval("submitted", "submitted")}
                disabled={busy}
                className="w-full bg-night text-night-foreground hover:bg-night/90 rounded-none eyebrow"
              >
                <Send className="h-4 w-4" /> Submit for approval
              </Button>
            )}

            {canReview && ["submitted", "under_review"].includes(plan.approval_status) && (
              <div className="space-y-2">
                <Label htmlFor="note" className="text-xs">
                  Notes for the planner
                </Label>
                <Textarea
                  id="note"
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="What needs changing, or why it's approved"
                />
                <Button
                  onClick={() => recordApproval("approved", "approved")}
                  disabled={busy}
                  className="w-full bg-night text-night-foreground hover:bg-night/90 rounded-none eyebrow"
                >
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button
                  onClick={() => recordApproval("revisions_requested", "revisions_requested")}
                  disabled={busy}
                  variant="outline"
                  className="w-full rounded-none eyebrow"
                >
                  Request revisions
                </Button>
              </div>
            )}

            {approvals.length === 0 ? (
              <p className="text-xs text-muted-foreground">Not yet submitted.</p>
            ) : (
              <ol className="space-y-3 pt-1">
                {approvals.map((a) => (
                  <li key={a.id} className="text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill
                        tone={
                          a.action === "approved"
                            ? "good"
                            : a.action === "revisions_requested"
                              ? "warn"
                              : "progress"
                        }
                      >
                        {label(a.action)}
                      </StatusPill>
                      <span className="text-muted-foreground">
                        {people.find((p) => p.id === a.actor_id)?.display_name ?? "Someone"} ·{" "}
                        {new Date(a.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    {a.notes && (
                      <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{a.notes}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {modules.length > 0 && (
            <section className="border border-border bg-card p-5">
              <div className="eyebrow text-accent text-[10px] mb-3">— Sections</div>
              <div className="flex flex-wrap gap-2">
                {modules.map((m) => (
                  <StatusPill key={m} tone="neutral">
                    {MODULES.find((x) => x.key === m)?.name ?? label(m)}
                  </StatusPill>
                ))}
              </div>
            </section>
          )}

          {canEdit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full rounded-none eyebrow text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  Delete this plan
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete "{plan.title}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Its tasks, budget, program and approval history go with it. This cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      const { error } = await supabase.from("event_plans").delete().eq("id", id);
                      if (error) return toast.error(error.message);
                      toast.success("Plan deleted");
                      navigate({ to: "/dashboard/planning" });
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow text-muted-foreground text-[10px]">{text}</div>
      <div className="mt-1 text-sm whitespace-pre-wrap">{children}</div>
    </div>
  );
}
