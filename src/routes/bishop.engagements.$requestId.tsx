import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Lock, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth";
import { useBishopDesk } from "@/hooks/useBishopDesk";
import { bishopDb, functionsBase, anonKey } from "@/lib/bishopDb";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/bishop/StatusBadge";
import {
  EVENT_TYPE_LABELS,
  SERVICE_ROLE_LABELS,
  STATUS_LABELS,
  TRAVEL_LABELS,
  formatEventWhen,
  type BookingActivity,
  type BookingNote,
  type BookingRequest,
  type BookingStatus,
} from "@/lib/bishopBooking";

export const Route = createFileRoute("/bishop/engagements/$requestId")({
  component: EngagementDossier,
});

/** Actions available from each status. Accept goes through the edge function. */
const TRANSITIONS: { to: BookingStatus; label: string; hint?: string }[] = [
  { to: "under_review", label: "Mark Under Review" },
  { to: "awaiting_bishop", label: "Send to Bishop" },
  { to: "tentatively_held", label: "Tentative Hold" },
  { to: "declined", label: "Decline" },
];

function EngagementDossier() {
  const { requestId } = Route.useParams();
  const { user } = useSession();
  const desk = useBishopDesk(user);
  const navigate = useNavigate();

  const [request, setRequest] = useState<BookingRequest | null>(null);
  const [notes, setNotes] = useState<BookingNote[]>([]);
  const [activity, setActivity] = useState<BookingActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: req }, { data: n }, { data: a }] = await Promise.all([
      bishopDb.from("bishop_booking_requests").select("*").eq("id", requestId).maybeSingle(),
      bishopDb
        .from("bishop_booking_notes")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false }),
      bishopDb
        .from("bishop_booking_activity")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false }),
    ]);
    setRequest(req ?? null);
    setMissing(!req);
    setNotes(n ?? []);
    setActivity(a ?? []);
    setLoading(false);
  }, [requestId]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (to: BookingStatus) => {
    setBusy(to);
    const { error } = await bishopDb
      .from("bishop_booking_requests")
      .update({
        status: to,
        ...(to === "declined"
          ? { decided_at: new Date().toISOString(), decided_by: user?.id ?? null }
          : {}),
      })
      .eq("id", requestId);
    setBusy(null);
    if (error) {
      toast.error(`Could not update: ${error.message}`);
      return;
    }
    toast.success(`Moved to ${STATUS_LABELS[to]}`);
    load();
  };

  /**
   * Accept is the one action that leaves the database: it writes to the
   * Bishop's Google Calendar. The edge function does the calendar write first
   * and only then flips the status, so a calendar failure leaves the request
   * exactly as it was rather than promising a church an engagement that was
   * never booked.
   */
  const accept = async () => {
    setBusy("accept");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${functionsBase()}/bishop-booking-accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey(),
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ request_id: requestId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Accept failed.");
        return;
      }
      if (data.warning) toast.warning(data.warning);
      else toast.success("Accepted and added to the calendar.");
      load();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  };

  const addNote = async (body: string, visibility: "secretary" | "bishop") => {
    if (!user) return;
    const { error } = await bishopDb.from("bishop_booking_notes").insert({
      request_id: requestId,
      author_id: user.id,
      author_email: desk.email ?? user.email ?? null,
      body,
      visibility,
    });
    if (error) {
      toast.error(`Could not save the note: ${error.message}`);
      return;
    }
    load();
  };

  if (loading) {
    return <div className="px-6 lg:px-10 py-12 eyebrow text-muted-foreground">Loading…</div>;
  }

  if (missing || !request) {
    return (
      <div className="px-6 lg:px-10 py-12">
        <BackLink />
        <div className="mt-8 border border-dashed border-border bg-card p-12 text-center">
          <div className="font-display text-2xl">Request not found</div>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have been removed.
          </p>
        </div>
      </div>
    );
  }

  const r = request;

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-12 max-w-6xl">
      <BackLink />

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={r.status} />
            <span className="eyebrow text-[10px] text-muted-foreground">{r.request_number}</span>
          </div>
          <h1 className="font-display text-3xl lg:text-5xl mt-3">{r.event_name}</h1>
          <p className="mt-2 text-muted-foreground">
            {r.church_name} · {r.church_city}, {r.church_state}
          </p>
        </div>
        <div className="text-sm text-right shrink-0">
          <div className="font-display text-xl">{formatEventWhen(r)}</div>
          <div className="text-muted-foreground mt-1">{EVENT_TYPE_LABELS[r.event_type]}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 border border-border bg-card p-5">
        <div className="eyebrow text-[10px] text-muted-foreground mb-4">Actions</div>
        <div className="flex flex-wrap gap-3">
          {TRANSITIONS.filter((t) => t.to !== r.status).map((t) => (
            <Button
              key={t.to}
              variant="outline"
              className="rounded-none eyebrow"
              disabled={busy !== null}
              onClick={() => changeStatus(t.to)}
            >
              {busy === t.to ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t.label}
            </Button>
          ))}

          <RequestInformation
            disabled={busy !== null}
            onSubmit={async (message) => {
              // Recorded as a note plus a timeline entry rather than sent as
              // email: there is no template for this yet, and silently doing
              // nothing would be worse than making the follow-up explicit.
              await addNote(`Information requested from the church:\n\n${message}`, "secretary");
              if (user) {
                await bishopDb.from("bishop_booking_activity").insert({
                  request_id: requestId,
                  actor_id: user.id,
                  actor_email: desk.email ?? user.email ?? null,
                  action: "information_requested",
                  detail: message.slice(0, 500),
                });
              }
              if (r.status === "new") await changeStatus("under_review");
              else load();
            }}
          />

          {r.status !== "accepted" && (
            <Button
              className="rounded-none eyebrow bg-gold text-gold-foreground hover:bg-gold/90"
              disabled={busy !== null}
              onClick={accept}
            >
              {busy === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Accept
            </Button>
          )}
        </div>

        {r.status === "accepted" && (
          <p className="mt-4 text-sm text-muted-foreground">
            {r.calendar_event_id ? (
              <>Added to the Bishop's calendar (<code className="text-xs">{r.calendar_event_id}</code>).</>
            ) : (
              <span className="inline-flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-live" />
                Accepted, but no calendar entry was created — check the Google credentials.
              </span>
            )}
          </p>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Section title="The Church">
            <Row label="Church">{r.church_name}</Row>
            <Row label="Pastor">{r.pastor_name}</Row>
            {r.affiliation && <Row label="Affiliation">{r.affiliation}</Row>}
            <Row label="Address">
              {r.church_address}, {r.church_city}, {r.church_state} {r.church_postal_code}
            </Row>
            {r.church_website && (
              <Row label="Website">
                <a
                  href={r.church_website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gold-deep hover:text-foreground inline-flex items-center gap-1.5"
                >
                  {r.church_website} <ExternalLink className="h-3 w-3" />
                </a>
              </Row>
            )}
          </Section>

          <Section title="Contact">
            <Row label="Name">
              {r.contact_name}
              {r.contact_role ? ` · ${r.contact_role}` : ""}
            </Row>
            <Row label="Email">
              <a href={`mailto:${r.contact_email}`} className="text-gold-deep hover:text-foreground">
                {r.contact_email}
              </a>
            </Row>
            <Row label="Phone">
              <a href={`tel:${r.contact_phone}`} className="text-gold-deep hover:text-foreground">
                {r.contact_phone}
              </a>
            </Row>
            <Row label="Prefers">{r.preferred_contact_method}</Row>
          </Section>

          <Section title="The Event">
            <Row label="Type">
              {EVENT_TYPE_LABELS[r.event_type]}
              {r.event_type_other ? ` — ${r.event_type_other}` : ""}
            </Row>
            <Row label="Asking">
              {SERVICE_ROLE_LABELS[r.service_role]}
              {r.service_role_other ? ` — ${r.service_role_other}` : ""}
            </Row>
            <Row label="When">{formatEventWhen(r)}</Row>
            {r.theme && <Row label="Theme">{r.theme}</Row>}
            {r.expected_attendance !== null && (
              <Row label="Attendance">{r.expected_attendance}</Row>
            )}
            {(r.venue_name || r.venue_address) && (
              <Row label="Venue">{[r.venue_name, r.venue_address].filter(Boolean).join(" · ")}</Row>
            )}
          </Section>

          <Section title="Travel & Accommodation">
            <Row label="Travel">{TRAVEL_LABELS[r.travel_arrangement]}</Row>
            {r.nearest_airport && <Row label="Airport">{r.nearest_airport}</Row>}
            <Row label="Party">{r.armor_bearer_count} besides the Bishop</Row>
            {r.accommodation_notes && <Row label="Accommodation">{r.accommodation_notes}</Row>}
            {r.honorarium_notes && <Row label="Honorarium">{r.honorarium_notes}</Row>}
            {r.additional_notes && <Row label="Notes">{r.additional_notes}</Row>}
          </Section>
        </div>

        <div className="space-y-6">
          <NotesPanel
            notes={notes}
            canWriteBishopNotes={desk.isBishop}
            onAdd={addNote}
          />
          <TimelinePanel activity={activity} />
        </div>
      </div>
    </div>
  );

  function BackLink() {
    return (
      <Link
        to="/bishop/engagements"
        className="eyebrow text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
      >
        <ArrowLeft className="h-3 w-3" /> All engagements
      </Link>
    );
  }
}

// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card p-6">
      <div className="eyebrow text-gold-deep mb-4">{title}</div>
      <dl className="space-y-3">{children}</dl>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

function RequestInformation({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (message: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" className="rounded-none eyebrow" disabled={disabled} onClick={() => setOpen(true)}>
        Request Information
      </Button>
    );
  }

  return (
    <div className="w-full border border-border bg-secondary p-4">
      <div className="eyebrow text-[10px] text-muted-foreground mb-2">
        What do you need from the church?
      </div>
      <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="mt-3 flex gap-3">
        <Button
          size="sm"
          className="rounded-none eyebrow bg-night text-night-foreground hover:bg-night/90"
          disabled={saving || text.trim() === ""}
          onClick={async () => {
            setSaving(true);
            await onSubmit(text.trim());
            setSaving(false);
            setText("");
            setOpen(false);
          }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Record
        </Button>
        <Button size="sm" variant="ghost" className="eyebrow" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        This is recorded on the request. It does not email the church — send that yourself.
      </p>
    </div>
  );
}

function NotesPanel({
  notes,
  canWriteBishopNotes,
  onAdd,
}: {
  notes: BookingNote[];
  canWriteBishopNotes: boolean;
  onAdd: (body: string, visibility: "secretary" | "bishop") => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<"secretary" | "bishop">("secretary");
  const [saving, setSaving] = useState(false);

  return (
    <div className="border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="eyebrow text-gold-deep">Internal Notes</div>
        <span className="inline-flex items-center gap-1.5 text-[10px] eyebrow text-muted-foreground">
          <Lock className="h-3 w-3" /> Never shown to the church
        </span>
      </div>

      <div className="mt-4">
        <Textarea
          rows={3}
          placeholder="Add a note…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {canWriteBishopNotes && (
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "secretary" | "bishop")}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="secretary">Secretary &amp; Bishop</option>
              <option value="bishop">Bishop only</option>
            </select>
          )}
          <Button
            size="sm"
            className="rounded-none eyebrow bg-night text-night-foreground hover:bg-night/90"
            disabled={saving || text.trim() === ""}
            onClick={async () => {
              setSaving(true);
              await onAdd(text.trim(), visibility);
              setSaving(false);
              setText("");
            }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add Note
          </Button>
        </div>
      </div>

      <ul className="mt-6 space-y-4">
        {notes.length === 0 && <li className="text-sm text-muted-foreground">No notes yet.</li>}
        {notes.map((n) => (
          <li key={n.id} className="border-l-2 border-border pl-4">
            <div className="flex flex-wrap items-center gap-2 text-[10px] eyebrow text-muted-foreground">
              <span>{n.author_email ?? "Desk"}</span>
              <span>·</span>
              <span>{new Date(n.created_at).toLocaleString()}</span>
              {n.visibility === "bishop" && (
                <span className="text-gold-deep">· Bishop only</span>
              )}
            </div>
            <p className="mt-1.5 text-sm whitespace-pre-wrap leading-relaxed">{n.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TimelinePanel({ activity }: { activity: BookingActivity[] }) {
  return (
    <div className="border border-border bg-card p-6">
      <div className="eyebrow text-gold-deep mb-4">Activity</div>
      <ol className="space-y-4">
        {activity.length === 0 && <li className="text-sm text-muted-foreground">Nothing yet.</li>}
        {activity.map((a) => (
          <li key={a.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
            <span className="mt-1.5 h-2 w-2 rounded-full bg-gold-deep shrink-0" />
            <div>
              <div className="text-sm">
                {describeActivity(a)}
              </div>
              <div className="text-[10px] eyebrow text-muted-foreground mt-1">
                {a.actor_email ?? "System"} · {new Date(a.created_at).toLocaleString()}
              </div>
              {a.detail && (
                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{a.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function describeActivity(a: BookingActivity): string {
  if (a.action === "submitted") return "Request received";
  if (a.action === "accepted") return "Accepted";
  if (a.action === "information_requested") return "Information requested from the church";
  if (a.from_status && a.to_status) {
    return `${STATUS_LABELS[a.from_status]} → ${STATUS_LABELS[a.to_status]}`;
  }
  if (a.to_status) return STATUS_LABELS[a.to_status];
  return a.action;
}
