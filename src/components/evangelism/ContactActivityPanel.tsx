import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Phone, CalendarHeart, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSession, useRoles } from "@/lib/auth";
import {
  loadContactActivity,
  addContactNote,
  updateContactNote,
  type ContactActivityRow,
  type ActivityKind,
} from "@/lib/contactActivity";

const ICONS: Record<ActivityKind, typeof Phone> = {
  text: MessageSquare,
  call: Phone,
  invite: CalendarHeart,
  note: StickyNote,
};

function label(row: ContactActivityRow) {
  if (row.kind === "invite") {
    // The title stored on the row, not a lookup: an event renamed next month
    // must not rewrite what this person was invited to.
    return row.event_title ? `Invited to ${row.event_title}` : "Invited to an event";
  }
  if (row.kind === "note") return "Note";
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
 * Who reached out to this soul, when, and how it went.
 *
 * The question this answers is the one asked in every follow-up conversation:
 * has anybody actually contacted this man since we met him? Without it, three
 * people call the same person on Tuesday and nobody calls the other eleven.
 *
 * Notes live here rather than in a box of their own so that the date and the
 * account of the conversation sit on the same line. A note can be corrected —
 * prose gets typed on a phone in a car park — but only its text: the database
 * refuses any change to when it was written, who wrote it, or which soul it
 * belongs to, and there is no delete. A history that can be tidied up after
 * the fact is not history.
 */
export function ContactActivityPanel({
  contactId,
  refreshKey = 0,
}: {
  contactId: string;
  refreshKey?: number;
}) {
  const { user } = useSession();
  const { isAdmin } = useRoles(user);

  const [rows, setRows] = useState<ContactActivityRow[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const refresh = useCallback(async () => {
    const r = await loadContactActivity(contactId);
    setRows(r);
  }, [contactId]);

  useEffect(() => {
    let active = true;
    loadContactActivity(contactId).then((r) => {
      if (active) setRows(r);
    });
    return () => {
      active = false;
    };
  }, [contactId, refreshKey]);

  const submitNote = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    const ok = await addContactNote(contactId, draft);
    setBusy(false);
    if (!ok) return toast.error("Couldn't save that note.");
    setDraft("");
    toast.success("Note added");
    refresh();
  };

  const saveEdit = async (id: string) => {
    if (!editDraft.trim()) return;
    setBusy(true);
    const ok = await updateContactNote(id, editDraft);
    setBusy(false);
    if (!ok) return toast.error("Couldn't update that note.");
    setEditingId(null);
    refresh();
  };

  return (
    <div className="bg-card border border-border p-6">
      <div className="eyebrow text-accent mb-5">— Activity</div>

      {/* The composer sits above the timeline, so writing a note and reading
          what happened last are the same glance. Admins only, matching the
          insert policy — a member cannot write one even if this rendered. */}
      {isAdmin && (
        <div className="mb-6 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="How did it go? What did they say?"
          />
          <Button
            onClick={submitNote}
            disabled={busy || !draft.trim()}
            size="sm"
            className="bg-night text-night-foreground hover:bg-night/90 rounded-none eyebrow w-full"
          >
            Add note
          </Button>
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing recorded yet. Notes, texts, calls and invites will appear here.
        </p>
      ) : (
        <ol className="space-y-4">
          {rows.map((row) => {
            const Icon = ICONS[row.kind];
            const mine = row.actor_id != null && row.actor_id === user?.id;
            const editing = editingId === row.id;

            return (
              <li key={row.id} className="flex gap-3">
                <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm leading-snug">{label(row)}</div>

                  {row.kind === "note" &&
                    (editing ? (
                      <div className="mt-1.5 space-y-2">
                        <Textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={3}
                          maxLength={2000}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveEdit(row.id)}
                            disabled={busy || !editDraft.trim()}
                            className="bg-night text-night-foreground hover:bg-night/90 rounded-none h-7 px-3 text-xs"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                            className="rounded-none h-7 px-3 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1 leading-relaxed">
                        {row.note}
                      </p>
                    ))}

                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2">
                    <span>
                      {row.actor_name ?? "A member"} · {when(row.created_at)}
                    </span>
                    {/* Marked rather than hidden: a corrected note should say
                        so, and the original date stays put either way. */}
                    {row.updated_at && <span className="italic">edited</span>}
                    {row.kind === "note" && mine && !editing && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(row.id);
                          setEditDraft(row.note ?? "");
                        }}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        Edit
                      </button>
                    )}
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
      {rows !== null && rows.some((r) => r.kind !== "note") && (
        <p className="text-xs text-muted-foreground mt-6 pt-4 border-t border-border">
          Texts and calls are recorded when the button is pressed. They go out from the member's own
          phone, so delivery isn't confirmed here.
        </p>
      )}
    </div>
  );
}
