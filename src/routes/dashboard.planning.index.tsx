import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  AlertCircle,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useCapabilities } from "@/lib/adminCapabilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill, TaskProgress } from "@/components/planning/StatusPill";
import { useStickyState, useStickyScroll } from "@/hooks/useStickyState";
import {
  label,
  planningTone,
  approvalTone,
  daysUntil,
  PLANNING_STATUSES,
  APPROVAL_STATUSES,
  type PlanningStatus,
  type ApprovalStatus,
} from "@/lib/eventPlanning";

export const Route = createFileRoute("/dashboard/planning/")({
  head: () => ({ meta: [{ title: "Event Planning — CCAC" }] }),
  component: PlanningDashboard,
});

type PlanRow = {
  id: string;
  title: string;
  starts_at: string | null;
  location: string | null;
  visibility: string;
  planning_status: PlanningStatus;
  approval_status: ApprovalStatus;
  owner_id: string | null;
  group_id: string | null;
  budget_estimate_cents: number | null;
  budget_approved_cents: number | null;
  template_id: string | null;
};

type Rollup = {
  plan_id: string;
  task_total: number;
  task_done: number;
  task_overdue: number;
  budget_estimated_cents: number;
  budget_actual_cents: number;
  budget_unpurchased: number;
};

function money(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function whenLabel(iso: string | null) {
  if (!iso) return "No date set";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function countdown(iso: string | null) {
  const d = daysUntil(iso);
  if (d == null) return null;
  if (d < 0) return `${Math.abs(d)} days ago`;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `${d} days away`;
}

function PlanningDashboard() {
  const { user } = useSession();
  const { has } = useCapabilities(user);
  const canReview = has("events_review");

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [rollups, setRollups] = useState<Map<string, Rollup>>(new Map());
  const [people, setPeople] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [myOpenTasks, setMyOpenTasks] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters survive a reload, like everywhere else in the dashboard.
  const [q, setQ] = useStickyState("plan.q", "");
  const [statusFilter, setStatusFilter] = useStickyState<string>("plan.status", "active");
  const [approvalFilter, setApprovalFilter] = useStickyState<string>("plan.approval", "all");
  const [yearFilter, setYearFilter] = useStickyState<string>("plan.year", "all");
  const [groupFilter, setGroupFilter] = useStickyState<string>("plan.group", "all");
  const [ownerFilter, setOwnerFilter] = useStickyState<string>("plan.owner", "all");
  const [visibilityFilter, setVisibilityFilter] = useStickyState<string>("plan.visibility", "all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useStickyScroll("plan.scroll", plans.length > 0);

  const load = async () => {
    setLoading(true);
    const [{ data: p, error }, { data: r }, { data: prof }, { data: g }, { data: t }] =
      await Promise.all([
        supabase
          .from("event_plans")
          .select(
            "id,title,starts_at,location,visibility,planning_status,approval_status,owner_id,group_id,budget_estimate_cents,budget_approved_cents,template_id",
          )
          .order("starts_at", { ascending: true, nullsFirst: false }),
        supabase.from("event_plan_rollup").select("*"),
        supabase.from("profiles").select("id,display_name"),
        supabase.from("groups").select("id,name"),
        supabase.from("event_plan_templates").select("id,name"),
      ]);

    if (error) toast.error(error.message);
    setPlans((p ?? []) as PlanRow[]);
    setRollups(new Map(((r ?? []) as Rollup[]).map((row) => [row.plan_id, row])));
    setPeople(
      Object.fromEntries(
        ((prof ?? []) as { id: string; display_name: string | null }[]).map((x) => [
          x.id,
          x.display_name ?? "—",
        ]),
      ),
    );
    setGroups(
      Object.fromEntries(((g ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name])),
    );
    setTemplates(
      Object.fromEntries(((t ?? []) as { id: string; name: string }[]).map((x) => [x.id, x.name])),
    );

    if (user) {
      const { count } = await supabase
        .from("event_plan_tasks")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", user.id)
        .not("status", "in", "(completed,not_needed)");
      setMyOpenTasks(count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const years = useMemo(() => {
    const set = new Set(
      plans.filter((p) => p.starts_at).map((p) => new Date(p.starts_at!).getFullYear().toString()),
    );
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [plans]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return plans.filter((p) => {
      if (ql && !p.title.toLowerCase().includes(ql)) return false;
      if (statusFilter === "active") {
        if (["completed", "archived", "cancelled"].includes(p.planning_status)) return false;
      } else if (statusFilter !== "all" && p.planning_status !== statusFilter) return false;
      if (approvalFilter !== "all" && p.approval_status !== approvalFilter) return false;
      if (yearFilter !== "all") {
        if (!p.starts_at || new Date(p.starts_at).getFullYear().toString() !== yearFilter)
          return false;
      }
      if (groupFilter !== "all" && p.group_id !== groupFilter) return false;
      if (ownerFilter !== "all" && p.owner_id !== ownerFilter) return false;
      if (visibilityFilter !== "all" && p.visibility !== visibilityFilter) return false;
      return true;
    });
  }, [
    plans,
    q,
    statusFilter,
    approvalFilter,
    yearFilter,
    groupFilter,
    ownerFilter,
    visibilityFilter,
  ]);

  // Headline numbers, over everything readable rather than the filtered view —
  // a filter should not make the backlog appear to shrink.
  const stats = useMemo(() => {
    const live = plans.filter((p) => !["archived", "cancelled"].includes(p.planning_status));
    const overdue = Array.from(rollups.values()).reduce(
      (n, r) => n + Number(r.task_overdue ?? 0),
      0,
    );
    const soon = live.filter((p) => {
      const d = daysUntil(p.starts_at);
      return d != null && d >= 0 && d <= 14;
    }).length;
    return {
      upcoming: live.filter((p) => (daysUntil(p.starts_at) ?? -1) >= 0).length,
      awaitingApproval: plans.filter((p) =>
        ["submitted", "under_review"].includes(p.approval_status),
      ).length,
      planning: live.filter((p) => p.planning_status === "planning").length,
      ready: live.filter((p) => p.planning_status === "ready").length,
      completed: plans.filter((p) => p.planning_status === "completed").length,
      overdue,
      soon,
    };
  }, [plans, rollups]);

  const activeFilterCount = [
    statusFilter === "active" ? "all" : statusFilter,
    approvalFilter,
    yearFilter,
    groupFilter,
    ownerFilter,
    visibilityFilter,
  ].filter((f) => f !== "all").length;

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow text-accent mb-2">— Event Planning</div>
          <h1 className="font-display text-5xl">Planning Center</h1>
          <p className="text-muted-foreground mt-2">
            Every event the church is working on, and what is left to do on each.
          </p>
        </div>
        <Button
          asChild
          className="bg-night text-night-foreground hover:bg-night/90 rounded-none px-6 py-6 eyebrow"
        >
          <Link to="/dashboard/planning/new">
            <Plus className="h-4 w-4" /> Plan an Event
          </Link>
        </Button>
      </div>

      {/* The numbers a leader opens this page to see. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Upcoming" value={stats.upcoming} />
        <Stat
          label="Awaiting approval"
          value={stats.awaitingApproval}
          highlight={stats.awaitingApproval > 0}
        />
        <Stat label="In planning" value={stats.planning} />
        <Stat label="Ready" value={stats.ready} />
        <Stat label="Within 2 weeks" value={stats.soon} />
        <Stat label="Overdue tasks" value={stats.overdue} alarm={stats.overdue > 0} />
        <Link
          to="/dashboard/planning/my-tasks"
          className="border border-border bg-card p-4 transition-colors hover:border-foreground/30"
        >
          <div className="eyebrow text-muted-foreground text-[10px]">My tasks</div>
          <div className="font-display text-3xl mt-1">{myOpenTasks}</div>
        </Link>
      </div>

      {/* Search always visible; the rest folds away on a phone. */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search events..."
              className="pl-9"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
            className="eyebrow shrink-0 rounded-none md:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Button>
        </div>

        <div
          className={`${filtersOpen ? "grid" : "hidden"} grid-cols-1 gap-3 sm:grid-cols-2 md:grid lg:grid-cols-6`}
        >
          <Filter value={statusFilter} onChange={setStatusFilter} placeholder="Status">
            <SelectItem value="active">Active events</SelectItem>
            <SelectItem value="all">Any status</SelectItem>
            {PLANNING_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {label(s)}
              </SelectItem>
            ))}
          </Filter>
          <Filter value={approvalFilter} onChange={setApprovalFilter} placeholder="Approval">
            <SelectItem value="all">Any approval</SelectItem>
            {APPROVAL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {label(s)}
              </SelectItem>
            ))}
          </Filter>
          <Filter value={yearFilter} onChange={setYearFilter} placeholder="Year">
            <SelectItem value="all">All years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </Filter>
          <Filter value={groupFilter} onChange={setGroupFilter} placeholder="Ministry">
            <SelectItem value="all">All ministries</SelectItem>
            {Object.entries(groups).map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </Filter>
          <Filter value={ownerFilter} onChange={setOwnerFilter} placeholder="Owner">
            <SelectItem value="all">Any owner</SelectItem>
            {Object.entries(people).map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </Filter>
          <Filter value={visibilityFilter} onChange={setVisibilityFilter} placeholder="Audience">
            <SelectItem value="all">Any audience</SelectItem>
            <SelectItem value="internal">Internal</SelectItem>
            <SelectItem value="invited">Invited guests</SelectItem>
            <SelectItem value="public">Public</SelectItem>
          </Filter>
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {filtered.length} of {plans.length}
        </div>
      </div>

      {loading ? (
        <div className="border border-dashed border-border p-16 text-center">
          <div className="eyebrow text-muted-foreground">Loading events...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border p-16 text-center">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
          <div className="eyebrow text-muted-foreground">
            {plans.length === 0 ? "No events planned yet" : "No events match these filters"}
          </div>
          {plans.length === 0 && (
            <p className="text-sm text-muted-foreground mt-2 mx-auto max-w-sm">
              Start from a template — a revival, a workshop, an outreach — and the tasks, program
              and deadlines come with it.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* One experience, two presentations: both render `filtered` through
              the same handlers. A phone gets cards rather than nine columns
              squeezed into 390px. */}
          <div className="hidden border border-border bg-card overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Planning</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const r = rollups.get(p.id);
                  return (
                    <TableRow key={p.id} className="group">
                      <TableCell>
                        <Link
                          to="/dashboard/planning/$id"
                          params={{ id: p.id }}
                          className="font-medium hover:underline"
                        >
                          {p.title}
                        </Link>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {p.template_id ? templates[p.template_id] : "Custom"}
                          {p.group_id && groups[p.group_id] ? ` · ${groups[p.group_id]}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {whenLabel(p.starts_at)}
                        <div className="text-xs text-muted-foreground">
                          {countdown(p.starts_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.owner_id ? (
                          (people[p.owner_id] ?? "—")
                        ) : (
                          <span className="italic">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusPill tone={planningTone(p.planning_status)}>
                          {label(p.planning_status)}
                        </StatusPill>
                      </TableCell>
                      <TableCell>
                        <StatusPill tone={approvalTone(p.approval_status)}>
                          {label(p.approval_status)}
                        </StatusPill>
                      </TableCell>
                      <TableCell>
                        <TaskProgress
                          done={Number(r?.task_done ?? 0)}
                          total={Number(r?.task_total ?? 0)}
                          overdue={Number(r?.task_overdue ?? 0)}
                        />
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {money(r?.budget_estimated_cents ?? p.budget_estimate_cents)}
                        {Number(r?.budget_unpurchased ?? 0) > 0 && (
                          <div className="text-xs text-gold-deep">
                            {r?.budget_unpurchased} to buy
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/dashboard/planning/$id"
                          params={{ id: p.id }}
                          aria-label={`Open ${p.title}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 md:hidden">
            {filtered.map((p) => {
              const r = rollups.get(p.id);
              return (
                <div key={p.id} className="border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/dashboard/planning/$id"
                        params={{ id: p.id }}
                        className="font-display text-xl underline-offset-4 hover:underline"
                      >
                        {p.title}
                      </Link>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {p.template_id ? templates[p.template_id] : "Custom"}
                        {p.group_id && groups[p.group_id] ? ` · ${groups[p.group_id]}` : ""}
                      </div>
                    </div>
                    <Link
                      to="/dashboard/planning/$id"
                      params={{ id: p.id }}
                      aria-label={`Open ${p.title}`}
                      className="shrink-0 text-muted-foreground"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Link>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {whenLabel(p.starts_at)}
                    </span>
                    {p.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {p.location}
                      </span>
                    )}
                    {countdown(p.starts_at) && <span>{countdown(p.starts_at)}</span>}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusPill tone={planningTone(p.planning_status)}>
                      {label(p.planning_status)}
                    </StatusPill>
                    <StatusPill tone={approvalTone(p.approval_status)}>
                      {label(p.approval_status)}
                    </StatusPill>
                    {Number(r?.task_overdue ?? 0) > 0 && (
                      <StatusPill tone="stop" icon={<AlertCircle className="h-3 w-3" />}>
                        {r?.task_overdue} overdue
                      </StatusPill>
                    )}
                  </div>

                  <div className="mt-3">
                    <TaskProgress
                      done={Number(r?.task_done ?? 0)}
                      total={Number(r?.task_total ?? 0)}
                      overdue={Number(r?.task_overdue ?? 0)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {canReview && stats.awaitingApproval > 0 && (
        <p className="text-sm text-muted-foreground">
          {stats.awaitingApproval} plan{stats.awaitingApproval === 1 ? "" : "s"} waiting on your
          review. Filter by approval status to see them.
        </p>
      )}
    </div>
  );
}

function Stat({
  label: text,
  value,
  highlight,
  alarm,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  alarm?: boolean;
}) {
  return (
    <div
      className={`border bg-card p-4 ${
        alarm && value > 0
          ? "border-destructive/40"
          : highlight && value > 0
            ? "border-gold/60"
            : "border-border"
      }`}
    >
      <div className="eyebrow text-muted-foreground text-[10px]">{text}</div>
      <div className="font-display text-3xl mt-1">{value}</div>
    </div>
  );
}

function Filter({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}
