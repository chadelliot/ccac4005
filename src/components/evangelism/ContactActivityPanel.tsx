import { useEffect, useState } from "react";
import { MessageSquare, Phone, CalendarHeart } from "lucide-react";
import {
  loadContactActivity,
  type ContactActivityRow,
  type ActivityKind,
} from "@/lib/contactActivity";

const ICONS: Record<ActivityKind, typeof Phone> = {
  text: MessageSquare,
  call: Phone,
  invite: CalendarHeart,
};

function label(row: ContactActivityRow) {
  if (row.kind === "invite") {
    // The title stored on the row, not a lookup: an event renamed next month
    // must not rewrite what this person was invited to.
    return row.event_title ? `Invited to ${row.event_title}` : "Invited to an event";
  }
  return row.kind === "call" ? "Called" : "Texted";
}

function when(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Who reached out to this soul, and when.
 *
 * The question this answers is the one asked in every follow-up conversation:
 * has anybody actually contacted this man since we met him? Without it, three
 * people call the same person on Tuesday and nobody calls the other eleven.
 *
 * Read-only and append-only. There is no edit or delete here and no policy
 * behind it that would allow one — a history that can be tidied up after the
 * fact is not history.
 */
export function ContactActivityPanel({
  contactId,
  refreshKey = 0,
}: {
  contactId: string;
  refreshKey?: number;
}) {
  const [rows, setRows] = useState<ContactActivityRow[] | null>(null);

  useEffect(() => {
    let active = true;
    loadContactActivity(contactId).then((r) => {
      if (active) setRows(r);
    });
    return () => {
      active = false;
    };
  }, [contactId, refreshKey]);

  return (
    <div className="bg-card border border-border p-6">
      <div className="eyebrow text-accent mb-5">— Activity</div>

      {rows === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No outreach recorded yet. Texts, calls and invites sent from this page will appear here.
        </p>
      ) : (
        <ol className="space-y-4">
          {rows.map((row) => {
            const Icon = ICONS[row.kind];
            return (
              <li key={row.id} className="flex gap-3">
                <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="text-sm leading-snug">{label(row)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {row.actor_name ?? "A member"} · {when(row.created_at)}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Says plainly what the log does and does not know. The text goes out
          from the member's own phone, so pressing the button is the only event
          this site can witness — claiming delivery would be a lie a leader
          might act on. */}
      {rows !== null && rows.length > 0 && (
        <p className="text-xs text-muted-foreground mt-6 pt-4 border-t border-border">
          Recorded when the button is pressed. Messages and calls go out from the member's own
          phone, so delivery isn't confirmed here.
        </p>
      )}
    </div>
  );
}
