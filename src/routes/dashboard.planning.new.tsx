import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Check, Trash2, Plus, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
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
import { StatusPill } from "@/components/planning/StatusPill";
import {
  MODULES,
  TASK_CATEGORIES,
  label,
  loadTemplates,
  loadTemplateProgram,
  generateTasks,
  type TemplateRow,
  type GeneratedTask,
} from "@/lib/eventPlanning";

export const Route = createFileRoute("/dashboard/planning/new")({
  head: () => ({ meta: [{ title: "Plan an Event — CCAC" }] }),
  component: CreateEventPlan,
});

const coreSchema = z.object({
  title: z.string().trim().min(2, "Give the event a name").max(160),
  purpose: z.string().trim().max(2000).optional(),
  desired_outcome: z.string().trim().max(2000).optional(),
  theme: z.string().trim().max(200).optional(),
  scripture: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  audience: z.string().trim().max(200).optional(),
  supporting_team: z.string().trim().max(500).optional(),
});

type Step = 1 | 2 | 3;

function CreateEventPlan() {
  const { user } = useSession();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [people, setPeople] = useState<{ id: string; display_name: string | null }[]>([]);

  // Step 1 — core
  const [templateId, setTemplateId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [outcome, setOutcome] = useState("");
  const [theme, setTheme] = useState("");
  const [scripture, setScripture] = useState("");
  const [groupId, setGroupId] = useState("none");
  const [ownerId, setOwnerId] = useState("none");
  const [supportingTeam, setSupportingTeam] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("20:00");
  const [location, setLocation] = useState("");
  const [venueKind, setVenueKind] = useState("ccac");
  const [audience, setAudience] = useState("");
  const [attendanceGoal, setAttendanceGoal] = useState("");
  const [visibility, setVisibility] = useState("internal");
  const [budgetEstimate, setBudgetEstimate] = useState("");

  // Step 2 — the questions
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  // Step 3 — the generated plan, editable before it is written
  const [tasks, setTasks] = useState<GeneratedTask[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadTemplates().then(setTemplates);
    supabase
      .from("groups")
      .select("id,name")
      .order("name")
      .then(({ data }) => setGroups((data ?? []) as { id: string; name: string }[]));
    supabase
      .from("profiles")
      .select("id,display_name")
      .order("display_name")
      .then(({ data }) => setPeople((data ?? []) as { id: string; display_name: string | null }[]));
  }, []);

  const template = templates.find((t) => t.id === templateId) ?? null;

  // Choosing a template pre-answers the questions it normally implies. The
  // planner still sees every question and can change any of them — the template
  // is a starting point, not a decision made for them.
  useEffect(() => {
    if (!template) return;
    const seeded: Record<string, boolean> = {};
    for (const m of MODULES) seeded[m.key] = template.default_modules.includes(m.key);
    setAnswers(seeded);
    if (!title.trim()) setTitle("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const activeModules = useMemo(
    () => MODULES.map((m) => m.key).filter((k) => answers[k]),
    [answers],
  );

  const eventDate = useMemo(() => {
    if (!startDate) return null;
    return new Date(`${startDate}T${startTime || "12:00"}:00`);
  }, [startDate, startTime]);

  const buildTasks = async () => {
    if (!template || !eventDate) return;
    setGenerating(true);
    const generated = await generateTasks(template, activeModules, eventDate);
    setTasks(generated);
    setGenerating(false);
  };

  const goToReview = async () => {
    await buildTasks();
    setStep(3);
  };

  const compressedCount = tasks.filter((t) => t.compressed).length;

  const save = async () => {
    if (!user) return;
    const parsed = coreSchema.safeParse({
      title,
      purpose: purpose || undefined,
      desired_outcome: outcome || undefined,
      theme: theme || undefined,
      scripture: scripture || undefined,
      location: location || undefined,
      audience: audience || undefined,
      supporting_team: supportingTeam || undefined,
    });
    if (!parsed.success) {
      setStep(1);
      return toast.error(parsed.error.issues[0].message);
    }
    if (!startDate) {
      setStep(1);
      return toast.error("An event date is needed to schedule the tasks");
    }

    setBusy(true);
    const startsAt = new Date(`${startDate}T${startTime || "00:00"}:00`).toISOString();
    const endsAt = endTime ? new Date(`${startDate}T${endTime}:00`).toISOString() : null;

    const { data: plan, error } = await supabase
      .from("event_plans")
      .insert({
        title: parsed.data.title,
        template_id: templateId || null,
        purpose: parsed.data.purpose ?? null,
        desired_outcome: parsed.data.desired_outcome ?? null,
        theme: parsed.data.theme ?? null,
        scripture: parsed.data.scripture ?? null,
        group_id: groupId === "none" ? null : groupId,
        owner_id: ownerId === "none" ? null : ownerId,
        supporting_team: parsed.data.supporting_team ?? null,
        starts_at: startsAt,
        ends_at: endsAt,
        location: parsed.data.location ?? null,
        venue_kind: venueKind,
        audience: parsed.data.audience ?? null,
        attendance_goal: attendanceGoal ? Number(attendanceGoal) : null,
        visibility,
        registration_required: Boolean(answers.registration),
        budget_estimate_cents: budgetEstimate ? Math.round(Number(budgetEstimate) * 100) : null,
        planning_status: "planning",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !plan) {
      setBusy(false);
      return toast.error(error?.message ?? "Couldn't create the plan");
    }

    // Modules, tasks and the program are written after the plan so a failure
    // part-way leaves a plan the planner can finish by hand rather than
    // nothing at all.
    if (activeModules.length > 0) {
      await supabase
        .from("event_plan_modules")
        .insert(activeModules.map((module_key) => ({ plan_id: plan.id, module_key })));
    }

    if (tasks.length > 0) {
      await supabase.from("event_plan_tasks").insert(
        tasks.map((t, i) => ({
          plan_id: plan.id,
          title: t.title,
          category: t.category,
          priority: t.priority,
          due_date: t.due_date,
          module_key: t.module_key,
          sort_order: i,
          created_by: user.id,
        })),
      );
    }

    if (templateId) {
      const program = await loadTemplateProgram(templateId);
      if (program.length > 0) {
        await supabase.from("event_plan_program_items").insert(
          program.map((item, i) => ({
            plan_id: plan.id,
            title: item.title,
            duration_minutes: item.duration_minutes,
            sort_order: i,
          })),
        );
      }
    }

    setBusy(false);
    toast.success(`${parsed.data.title} created with ${tasks.length} tasks`);
    navigate({ to: "/dashboard/planning/$id", params: { id: plan.id } });
  };

  return (
    <div className="max-w-3xl space-y-8">
      <Link
        to="/dashboard/planning"
        className="eyebrow text-muted-foreground inline-flex items-center gap-2 hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Planning Center
      </Link>

      <div>
        <div className="eyebrow text-accent mb-2">— Step {step} of 3</div>
        <h1 className="font-display text-5xl">
          {step === 1 ? "Plan an Event" : step === 2 ? "About this event" : "Review the plan"}
        </h1>
        <p className="text-muted-foreground mt-2">
          {step === 1
            ? "Start from a template. The tasks, program and deadlines come with it."
            : step === 2
              ? "These answers decide which sections the event gets and what work is scheduled."
              : "Everything here is a suggestion. Remove what you don't need before saving."}
        </p>
      </div>

      {/* ---------------------------------------------------------------- 1 */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <Label>Event type</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {template?.description && (
              <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
            )}
          </div>

          <div>
            <Label htmlFor="title">Event name</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              placeholder="Fall Revival 2026"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="purpose">Purpose</Label>
              <Textarea
                id="purpose"
                rows={3}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Why are we holding this?"
              />
            </div>
            <div>
              <Label htmlFor="outcome">Desired outcome</Label>
              <Textarea
                id="outcome"
                rows={3}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="What should be different afterwards?"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="theme">Theme</Label>
              <Input
                id="theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="scripture">Supporting scripture</Label>
              <Input
                id="scripture"
                value={scripture}
                onChange={(e) => setScripture(e.target.value)}
                maxLength={200}
                placeholder="Acts 2:38"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Hosting ministry</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Church-wide</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Primary owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not assigned yet</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name ?? "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="team">Supporting team</Label>
            <Input
              id="team"
              value={supportingTeam}
              onChange={(e) => setSupportingTeam(e.target.value)}
              maxLength={500}
              placeholder="Who else is working on this?"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="date">Event date</Label>
              <Input
                id="date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="start">Start time</Label>
              <Input
                id="start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end">End time</Label>
              <Input
                id="end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
                placeholder="4005 Old York Rd"
              />
            </div>
            <div>
              <Label>Where is it held?</Label>
              <Select value={venueKind} onValueChange={setVenueKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ccac">At CCAC</SelectItem>
                  <SelectItem value="offsite">Off-site</SelectItem>
                  <SelectItem value="outdoor">Outdoors</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="audience">Intended audience</Label>
              <Input
                id="audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                maxLength={200}
                placeholder="The community"
              />
            </div>
            <div>
              <Label htmlFor="goal">Attendance goal</Label>
              <Input
                id="goal"
                type="number"
                min={0}
                value={attendanceGoal}
                onChange={(e) => setAttendanceGoal(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="budget">Budget estimate ($)</Label>
              <Input
                id="budget"
                type="number"
                min={0}
                step="0.01"
                value={budgetEstimate}
                onChange={(e) => setBudgetEstimate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Who is this open to?</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal — the church family</SelectItem>
                <SelectItem value="invited">Invited guests</SelectItem>
                <SelectItem value="public">Public — open to anyone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => setStep(2)}
              disabled={!templateId || title.trim().length < 2 || !startDate}
              className="bg-night text-night-foreground hover:bg-night/90 rounded-none px-8 py-6 eyebrow"
            >
              Continue
            </Button>
          </div>
          {(!templateId || title.trim().length < 2 || !startDate) && (
            <p className="text-right text-xs text-muted-foreground">
              An event type, a name and a date are needed before the tasks can be scheduled.
            </p>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- 2 */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="space-y-2">
            {MODULES.map((m) => (
              <label
                key={m.key}
                className="flex cursor-pointer items-start gap-3 border border-border bg-card p-4 transition-colors hover:border-foreground/30"
              >
                <input
                  type="checkbox"
                  checked={Boolean(answers[m.key])}
                  onChange={(e) => setAnswers({ ...answers, [m.key]: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-current"
                />
                <span className="min-w-0">
                  <span className="block text-sm">{m.question}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Adds the {m.name.toLowerCase()} section and its tasks
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap justify-between gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="rounded-none eyebrow">
              Back
            </Button>
            <Button
              onClick={goToReview}
              disabled={generating}
              className="bg-night text-night-foreground hover:bg-night/90 rounded-none px-8 py-6 eyebrow"
            >
              {generating ? "Building the plan..." : "Build the plan"}
            </Button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- 3 */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {activeModules.map((k) => (
              <StatusPill key={k} tone="progress">
                {MODULES.find((m) => m.key === k)?.name ?? label(k)}
              </StatusPill>
            ))}
            {activeModules.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No optional sections — this plan gets the core tasks only.
              </p>
            )}
          </div>

          {compressedCount > 0 && (
            <div className="flex gap-3 border border-gold/60 bg-gold/10 p-4">
              <AlertCircle className="h-4 w-4 shrink-0 text-gold-deep mt-0.5" />
              <p className="text-sm">
                This event is sooner than this type of event usually allows for, so the schedule has
                been compressed into the time available. The order is unchanged and nothing is
                overdue on day one — but {compressedCount} task
                {compressedCount === 1 ? "" : "s"} will need attention quickly.
              </p>
            </div>
          )}

          <div className="border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="eyebrow text-accent">— {tasks.length} tasks</div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-none eyebrow"
                onClick={() =>
                  setTasks([
                    ...tasks,
                    {
                      title: "",
                      category: "leadership",
                      priority: "normal",
                      due_date: startDate,
                      module_key: null,
                      sort_order: tasks.length,
                      compressed: false,
                    },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add task
              </Button>
            </div>

            <ul className="divide-y divide-border">
              {tasks.map((t, i) => (
                <li
                  key={i}
                  className="grid gap-2 p-4 sm:grid-cols-[1fr_9rem_9rem_2.5rem] sm:items-end"
                >
                  <div>
                    <Label htmlFor={`task-${i}`} className="sr-only">
                      Task name
                    </Label>
                    <Input
                      id={`task-${i}`}
                      value={t.title}
                      placeholder="What needs doing?"
                      onChange={(e) => {
                        const next = [...tasks];
                        next[i] = { ...t, title: e.target.value };
                        setTasks(next);
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`cat-${i}`} className="sr-only">
                      Category
                    </Label>
                    <Select
                      value={t.category}
                      onValueChange={(v) => {
                        const next = [...tasks];
                        next[i] = { ...t, category: v };
                        setTasks(next);
                      }}
                    >
                      <SelectTrigger id={`cat-${i}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {label(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`due-${i}`} className="sr-only">
                      Due date
                    </Label>
                    <Input
                      id={`due-${i}`}
                      type="date"
                      value={t.due_date}
                      onChange={(e) => {
                        const next = [...tasks];
                        next[i] = { ...t, due_date: e.target.value };
                        setTasks(next);
                      }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${t.title || "task"}`}
                    onClick={() => setTasks(tasks.filter((_, n) => n !== i))}
                    className="text-destructive hover:bg-destructive/10 rounded-none justify-self-start sm:justify-self-center"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
              {tasks.length === 0 && (
                <li className="p-8 text-center text-sm text-muted-foreground">
                  No tasks yet. Add one above, or go back and switch on a section.
                </li>
              )}
            </ul>
          </div>

          <div className="flex flex-wrap justify-between gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="rounded-none eyebrow">
              Back
            </Button>
            <Button
              onClick={save}
              disabled={busy || tasks.some((t) => !t.title.trim())}
              className="bg-night text-night-foreground hover:bg-night/90 rounded-none px-8 py-6 eyebrow"
            >
              <Check className="h-4 w-4" /> {busy ? "Creating..." : "Create event"}
            </Button>
          </div>
          {tasks.some((t) => !t.title.trim()) && (
            <p className="text-right text-xs text-muted-foreground">
              Every task needs a name, or remove the empty one.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
