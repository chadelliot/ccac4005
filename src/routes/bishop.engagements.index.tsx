import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Inbox } from "lucide-react";
import { Input } from "@/components/ui/input";
import { bishopDb } from "@/lib/bishopDb";
import { StatusBadge } from "@/components/bishop/StatusBadge";
import {
  BUCKET_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  SUMMARY_BUCKETS,
  bucketCounts,
  formatEventWhen,
  isUpcoming,
  type BookingRequest,
  type SummaryBucket,
} from "@/lib/bishopBooking";

export const Route = createFileRoute("/bishop/engagements/")({
  component: EngagementsIndex,
});

type Filters = {
  bucket: SummaryBucket | "all";
  from: string;
  to: string;
  church: string;
  location: string;
  eventType: string;
};

const EMPTY_FILTERS: Filters = {
  bucket: "all",
  from: "",
  to: "",
  church: "",
  location: "",
  eventType: "",
};

function EngagementsIndex() {
  const [rows, setRows] = useState<BookingRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  useEffect(() => {
    let active = true;
    bishopDb
      .from("bishop_booking_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }: { data: BookingRequest[] | null; error: { message: string } | null }) => {
        if (!active) return;
        if (error) setError(error.message);
        setRows(data ?? []);
      });
    return () => {
      active = false;
    };
  }, []);

  // Counts come from the unfiltered set on purpose: a summary that changed
  // every time you narrowed the list would stop being a summary.
  const counts = useMemo(() => bucketCounts(rows ?? []), [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = filters.church.trim().toLowerCase();
    const place = filters.location.trim().toLowerCase();
    return rows.filter((r) => {
      if (filters.bucket === "upcoming") {
        if (!isUpcoming(r)) return false;
      } else if (filters.bucket !== "all" && r.status !== filters.bucket) {
        return false;
      }
      if (filters.from && r.event_date < filters.from) return false;
      if (filters.to && r.event_date > filters.to) return false;
      if (needle && !`${r.church_name} ${r.pastor_name}`.toLowerCase().includes(needle)) return false;
      if (place && !`${r.church_city} ${r.church_state}`.toLowerCase().includes(place)) return false;
      if (filters.eventType && r.event_type !== filters.eventType) return false;
      return true;
    });
  }, [rows, filters]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow text-gold-deep">— Bishop's Desk</div>
          <h1 className="font-display text-4xl lg:text-5xl mt-2">Engagements</h1>
        </div>
        {rows && (
          <div className="text-sm text-muted-foreground">
            {filtered.length} of {rows.length} shown
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {SUMMARY_BUCKETS.map((b) => {
          const active = filters.bucket === b;
          return (
            <button
              key={b}
              type="button"
              aria-pressed={active}
              onClick={() => set("bucket", active ? "all" : b)}
              className={`border p-4 text-left transition-colors ${
                active
                  ? "border-night bg-night text-night-foreground"
                  : "border-border bg-card hover:border-foreground/30"
              }`}
            >
              <div className={`eyebrow text-[10px] ${active ? "text-gold" : "text-muted-foreground"}`}>
                {BUCKET_LABELS[b]}
              </div>
              <div className="font-display text-3xl mt-2">{counts[b]}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <LabelledField label="Church or pastor">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={filters.church}
                onChange={(e) => set("church", e.target.value)}
                placeholder="Search…"
              />
            </div>
          </LabelledField>
          <LabelledField label="City or state">
            <Input value={filters.location} onChange={(e) => set("location", e.target.value)} />
          </LabelledField>
          <LabelledField label="Event type">
            <select
              value={filters.eventType}
              onChange={(e) => set("eventType", e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EVENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </LabelledField>
          <LabelledField label="From">
            <Input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} />
          </LabelledField>
          <LabelledField label="To">
            <Input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} />
          </LabelledField>
        </div>
        {JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS) && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="mt-4 eyebrow text-gold-deep hover:text-foreground transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-8">
        {error ? (
          <Panel>
            <p className="text-sm text-muted-foreground">
              Could not load engagements: {error}
            </p>
          </Panel>
        ) : rows === null ? (
          <Panel>
            <div className="eyebrow text-muted-foreground">Loading…</div>
          </Panel>
        ) : filtered.length === 0 ? (
          <Panel>
            <Inbox className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">
              {rows.length === 0
                ? "No invitations have been received yet."
                : "No engagements match these filters."}
            </p>
          </Panel>
        ) : (
          <ul className="space-y-3">
            {filtered.map((r) => (
              <li key={r.id}>
                <Link
                  to="/bishop/engagements/$requestId"
                  params={{ requestId: r.id }}
                  className="block border border-border bg-card p-5 hover:border-foreground/30 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusBadge status={r.status} />
                        <span className="eyebrow text-[10px] text-muted-foreground">
                          {r.request_number}
                        </span>
                        {isUpcoming(r) && (
                          <span className="eyebrow text-[10px] text-gold-deep">Upcoming</span>
                        )}
                      </div>
                      <h2 className="font-display text-2xl mt-2 truncate">{r.event_name}</h2>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {r.church_name} · {r.church_city}, {r.church_state}
                      </div>
                    </div>
                    <div className="text-sm text-right shrink-0">
                      <div>{formatEventWhen(r)}</div>
                      <div className="text-muted-foreground mt-1">
                        {EVENT_TYPE_LABELS[r.event_type]}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LabelledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow text-[10px] text-muted-foreground mb-2">{label}</div>
      {children}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-border p-12 text-center bg-card">{children}</div>
  );
}
