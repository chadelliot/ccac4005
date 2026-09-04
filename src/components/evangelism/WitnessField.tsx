import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listWitnesses, resolveWitnessId, splitWitnessNames, type Witness } from "@/lib/witnesses";

/**
 * Who witnessed to this soul — correctable in place.
 *
 * Credit was previously fixed at the moment the contact was typed in, so "Chad
 * Parker" logged when it should have said "Pastor Parker" stayed wrong on the
 * harvest list forever. The name people are known by in ministry is not always
 * the name on their account.
 *
 * A plain text input backed by a datalist rather than a dropdown, because both
 * halves are needed: focusing it offers everyone already on the books, and
 * typing past them creates someone new. A <select> would forbid the second, and
 * a free-text box alone would let "Evg Bri" and "Evg. Bri" drift into two
 * people — resolveWitnessId matches case-insensitively against a unique index,
 * so picking from the list and retyping the same name reach the same record.
 */
export function WitnessField({
  contactId,
  witnessName,
  canEdit,
  onSaved,
  className = "",
}: {
  contactId: string;
  witnessName: string | null;
  canEdit: boolean;
  onSaved?: (name: string | null) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(witnessName ?? "");
  const [options, setOptions] = useState<Witness[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!editing) setDraft(witnessName ?? "");
  }, [witnessName, editing]);

  const startEdit = () => {
    setDraft(witnessName ?? "");
    setEditing(true);
    // Fetched on the way in rather than for every row on the page — a table of
    // eighty-five contacts should not make eighty-five requests for a list only
    // one of them will show.
    if (options.length === 0) listWitnesses().then(setOptions);
  };

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = async () => {
    const typed = draft.trim();
    if (typed === (witnessName ?? "").trim()) {
      setEditing(false);
      return;
    }

    setBusy(true);
    // "Pastor Parker / Bri" credits the first and keeps the rest alongside,
    // matching how the name is parsed when a contact is first logged.
    const { primary, coWitness } = splitWitnessNames(typed);
    const witness_id = primary ? await resolveWitnessId(primary) : null;

    const { error } = await supabase
      .from("evangelism_contacts")
      .update({ witness_id, co_witness: coWitness })
      .eq("id", contactId);
    setBusy(false);

    if (error) {
      toast.error("Couldn't change the witness — you may not have permission.");
      setDraft(witnessName ?? "");
      setEditing(false);
      return;
    }

    setEditing(false);
    onSaved?.(primary || null);
    // Refreshed so a name created just now is offered on the next row.
    listWitnesses().then(setOptions);
    toast.success(primary ? `Witness set to ${primary}` : "Witness cleared");
  };

  if (!canEdit) {
    return (
      <span className={className}>
        {witnessName ?? <span className="text-muted-foreground">—</span>}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        title="Change who witnessed"
        className={`group/w inline-flex items-center gap-1.5 text-left hover:text-foreground ${className}`}
      >
        {witnessName ?? <span className="text-muted-foreground">—</span>}
        <Pencil className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/w:opacity-60" />
      </button>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        value={draft}
        list={listId}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            // Abandon without saving, and without the blur handler treating the
            // exit as a commit.
            setDraft(witnessName ?? "");
            setEditing(false);
          }
        }}
        placeholder="Who witnessed"
        maxLength={120}
        className={`w-full min-w-[8rem] border border-border bg-background px-2 py-1 text-sm outline-none focus:border-foreground/40 ${className}`}
      />
      <datalist id={listId}>
        {options.map((w) => (
          <option key={w.id} value={w.name} />
        ))}
      </datalist>
    </>
  );
}
