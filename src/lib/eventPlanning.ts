import { supabase } from "@/integrations/supabase/client";

/**
 * Vocabulary and template mechanics for the Event Planning Center.
 *
 * Kept out of the routes so the dashboard, the creation flow and the workspace
 * all describe a status the same way. Labels live beside their values because
 * "revisions_requested" is a column value and "Revisions requested" is what a
 * person reads, and the two drifting apart is how a screen ends up saying
 * "Not_started".
 */

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

export const PLANNING_STATUSES = [
  "draft",
  "planning",
  "ready",
  "completed",
  "archived",
  "postponed",
  "cancelled",
] as const;
export type PlanningStatus = (typeof PLANNING_STATUSES)[number];

export const APPROVAL_STATUSES = [
  "not_submitted",
  "submitted",
  "under_review",
  "revisions_requested",
  "approved",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const TASK_STATUSES = [
  "not_started",
  "in_progress",
  "blocked",
  "awaiting_approval",
  "completed",
  "not_needed",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_CATEGORIES = [
  "leadership",
  "program",
  "speaker",
  "promotion",
  "registration",
  "hospitality",
  "food",
  "purchasing",
  "equipment",
  "facilities",
  "music",
  "media",
  "evangelism",
  "transportation",
  "volunteers",
  "safety",
  "setup",
  "cleanup",
  "follow_up",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

const LABELS: Record<string, string> = {
  draft: "Draft",
  planning: "Planning",
  ready: "Ready",
  completed: "Completed",
  archived: "Archived",
  postponed: "Postponed",
  cancelled: "Cancelled",
  not_submitted: "Not submitted",
  submitted: "Submitted",
  under_review: "Under review",
  revisions_requested: "Revisions requested",
  approved: "Approved",
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  awaiting_approval: "Awaiting approval",
  not_needed: "Not needed",
  follow_up: "Follow-up",
  children_youth: "Children and youth",
  evangelism_followup: "Evangelism and follow-up",
  guest_ministry: "Guest ministry",
  multi_day: "Multi-day",
  ccac: "At CCAC",
  offsite: "Off-site",
  outdoor: "Outdoors",
  internal: "Internal",
  invited: "Invited guests",
  public: "Public",
  owned: "Already owned",
  borrowed: "Borrowed",
  donated: "Donated",
  purchase: "To purchase",
  rental: "To rent",
  to_do: "To do",
  ordered: "Ordered",
  purchased: "Purchased",
  received: "Received",
};

/** Human wording for any status or key. Falls back to a readable form. */
export function label(value: string | null | undefined): string {
  if (!value) return "—";
  if (LABELS[value]) return LABELS[value];
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

/**
 * How a status should read at a glance.
 *
 * Every tone carries a word, never a colour alone: someone who cannot tell the
 * amber from the grey still reads "Overdue". Colour is the second signal, not
 * the only one.
 */
export type Tone = "neutral" | "progress" | "good" | "warn" | "stop";

export function planningTone(s: PlanningStatus): Tone {
  if (s === "ready" || s === "completed") return "good";
  if (s === "cancelled" || s === "postponed") return "stop";
  if (s === "planning") return "progress";
  return "neutral";
}

export function approvalTone(s: ApprovalStatus): Tone {
  if (s === "approved") return "good";
  if (s === "revisions_requested") return "warn";
  if (s === "submitted" || s === "under_review") return "progress";
  return "neutral";
}

export function taskTone(s: TaskStatus): Tone {
  if (s === "completed") return "good";
  if (s === "blocked") return "stop";
  if (s === "awaiting_approval") return "warn";
  if (s === "in_progress") return "progress";
  return "neutral";
}

export const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-border text-muted-foreground",
  progress: "border-royal/40 text-royal",
  good: "border-accent/50 text-accent-foreground bg-accent/15",
  warn: "border-gold/60 text-gold-deep bg-gold/15",
  stop: "border-destructive/40 text-destructive",
};

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

/**
 * The optional sections, and the question that turns each one on.
 *
 * The questions are how the creation flow avoids being a form of eighteen
 * checkboxes nobody reads: a planner answers what is true about their event and
 * the modules follow. `key` matches event_plan_modules.module_key and the
 * module_key on template tasks.
 */
export const MODULES = [
  {
    key: "guest_ministry",
    name: "Guest ministry",
    question: "Is there a guest speaker, preacher, musician or facilitator?",
  },
  { key: "registration", name: "Registration", question: "Is registration or an RSVP required?" },
  {
    key: "fundraising",
    name: "Money collected",
    question: "Will money be collected — offering, tickets or fees?",
  },
  { key: "food", name: "Food and refreshments", question: "Will food or refreshments be served?" },
  { key: "promotion", name: "Promotion", question: "Is a flyer or public promotion required?" },
  {
    key: "children_youth",
    name: "Children and youth",
    question: "Will children or youth participate?",
  },
  { key: "transportation", name: "Transportation", question: "Is transportation required?" },
  { key: "outdoor", name: "Outdoor event", question: "Is any part of this held outdoors?" },
  { key: "vendors", name: "Vendors", question: "Does the event include vendors?" },
  {
    key: "photography",
    name: "Photography and video",
    question: "Is photography, video or streaming required?",
  },
  { key: "volunteers", name: "Volunteers", question: "Are volunteers required?" },
  {
    key: "gifts",
    name: "Gifts and appreciation",
    question: "Will gifts, plaques or awards be given?",
  },
  {
    key: "evangelism_followup",
    name: "Evangelism and follow-up",
    question: "Does this need visitor follow-up?",
  },
  { key: "multi_day", name: "Multi-day", question: "Does this run across more than one day?" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

// ---------------------------------------------------------------------------
// Task timing
// ---------------------------------------------------------------------------

/** Local date, not UTC — after ~7pm Eastern toISOString() is already tomorrow. */
export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
  return Math.ceil((then.getTime() - Date.now()) / 86_400_000);
}

/**
 * Turn a template's "weeks before" into a real date.
 *
 * The compression is the point. A template written for sixteen weeks, applied
 * to an event three weeks away, would otherwise generate a dozen tasks already
 * overdue on the day the plan is created — and a list that starts out red is a
 * list people stop reading.
 *
 * So when there is less runway than the template assumes, the whole schedule is
 * scaled into the time that actually exists. Order and relative urgency
 * survive; the impossible dates do not. Anything still landing in the past is
 * pulled to today rather than backdated, because a task cannot have been due
 * before it was written.
 */
export function taskDueDate(
  eventDate: Date,
  weeksBefore: number,
  templateLeadWeeks: number,
  createdOn: Date = new Date(),
): { due: string; compressed: boolean } {
  const msPerWeek = 7 * 86_400_000;
  const runwayWeeks = (eventDate.getTime() - createdOn.getTime()) / msPerWeek;

  // Negative weeksBefore means after the event — never compressed, since the
  // runway does not constrain it.
  if (weeksBefore <= 0) {
    const due = new Date(eventDate.getTime() - weeksBefore * msPerWeek);
    return { due: isoDate(due), compressed: false };
  }

  const compressed = runwayWeeks > 0 && runwayWeeks < templateLeadWeeks;
  const scale = compressed ? runwayWeeks / templateLeadWeeks : 1;
  const due = new Date(eventDate.getTime() - weeksBefore * scale * msPerWeek);

  // Never earlier than today.
  const today = new Date(createdOn);
  today.setHours(12, 0, 0, 0);
  if (due < today) return { due: isoDate(today), compressed: true };

  return { due: isoDate(due), compressed };
}

// ---------------------------------------------------------------------------
// Creating a plan from a template
// ---------------------------------------------------------------------------

export type TemplateRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  default_modules: string[];
  lead_weeks: number;
};

export type GeneratedTask = {
  title: string;
  category: string;
  priority: string;
  due_date: string;
  module_key: string | null;
  sort_order: number;
  compressed: boolean;
};

export async function loadTemplates(): Promise<TemplateRow[]> {
  const { data } = await supabase
    .from("event_plan_templates")
    .select("id,key,name,description,default_modules,lead_weeks")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as TemplateRow[];
}

/**
 * The tasks a template would generate, before anything is written.
 *
 * Returned rather than inserted so the planner can review, edit and remove them
 * first — the brief is explicit that a generated plan is a proposal, not a
 * decision already taken on their behalf.
 */
export async function generateTasks(
  template: TemplateRow,
  activeModules: string[],
  eventDate: Date,
): Promise<GeneratedTask[]> {
  const { data } = await supabase
    .from("event_plan_template_tasks")
    .select("title,category,priority,weeks_before,module_key,sort_order")
    .eq("template_id", template.id)
    .order("sort_order");

  return (
    (data ?? []) as {
      title: string;
      category: string;
      priority: string;
      weeks_before: number;
      module_key: string | null;
      sort_order: number;
    }[]
  )
    .filter((t) => !t.module_key || activeModules.includes(t.module_key))
    .map((t) => {
      const { due, compressed } = taskDueDate(
        eventDate,
        Number(t.weeks_before),
        template.lead_weeks,
      );
      return {
        title: t.title,
        category: t.category,
        priority: t.priority,
        due_date: due,
        module_key: t.module_key,
        sort_order: t.sort_order,
        compressed,
      };
    });
}

export async function loadTemplateProgram(templateId: string) {
  const { data } = await supabase
    .from("event_plan_template_program_items")
    .select("title,duration_minutes,sort_order")
    .eq("template_id", templateId)
    .order("sort_order");
  return (data ?? []) as { title: string; duration_minutes: number; sort_order: number }[];
}

/** How far through a plan's tasks the team is, and what is late. */
export function taskProgress(tasks: { status: string; due_date: string | null }[]) {
  const live = tasks.filter((t) => t.status !== "not_needed");
  const done = live.filter((t) => t.status === "completed").length;
  const today = isoDate(new Date());
  const overdue = live.filter(
    (t) => t.status !== "completed" && t.due_date != null && t.due_date < today,
  ).length;
  return {
    total: live.length,
    done,
    overdue,
    percent: live.length === 0 ? 0 : Math.round((done / live.length) * 100),
  };
}
