import { useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keep a soul on your own short list.
 *
 * The star is personal. Eighty-eight contacts is more than anyone works at
 * once, and "these are the few I am pursuing" is a different answer for the
 * sister running the women's follow-ups than for the pastor — so starring
 * writes a row against your account rather than a flag on the contact, and
 * nobody sees anyone else's list.
 *
 * Because it changes nothing about the soul's record, this is offered to
 * anyone who can see them. It is not an edit, and it does not need the
 * permission that editing needs.
 *
 * Optimistic: the star fills the instant it is pressed and rolls back if the
 * write fails. This gets used walking between doors on a phone, where waiting
 * on a round trip to see whether a tap registered is how you tap twice and turn
 * it back off.
 */
export function FocusToggle({
  contactId,
  value,
  onChange,
  size = "default",
  withLabel = false,
}: {
  contactId: string;
  value: boolean;
  onChange?: (next: boolean) => void;
  size?: "default" | "sm";
  withLabel?: boolean;
}) {
  const [on, setOn] = useState(value);
  const [busy, setBusy] = useState(false);

  // Rendered from the prop when the parent's set changes underneath us — a
  // refetch after some other edit should not leave a stale star.
  if (value !== on && !busy) setOn(value);

  const toggle = async () => {
    if (busy) return;
    const next = !on;
    setOn(next);
    setBusy(true);

    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) {
      setOn(!next);
      setBusy(false);
      return;
    }

    const { error } = next
      ? await supabase.from("contact_focus").insert({ contact_id: contactId, user_id: userId })
      : await supabase
          .from("contact_focus")
          .delete()
          .eq("contact_id", contactId)
          .eq("user_id", userId);

    setBusy(false);
    if (error) {
      setOn(!next); // put the star back where it was
      toast.error("Couldn't change your focus list.");
      return;
    }
    onChange?.(next);
  };

  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      // Named for what pressing it does now, not for what the field is called.
      aria-label={on ? "Remove from my focus list" : "Add to my focus list"}
      title={on ? "On your focus list — press to remove" : "Add to your focus list"}
      className={`inline-flex shrink-0 items-center gap-1.5 text-xs transition-colors ${
        on ? "text-accent" : "text-muted-foreground hover:text-foreground"
      } ${busy ? "opacity-60" : ""}`}
    >
      <Star className={icon} fill={on ? "currentColor" : "none"} />
      {withLabel && <span className="eyebrow">{on ? "In focus" : "Focus"}</span>}
    </button>
  );
}

/** Every contact the signed-in person has starred. */
export async function loadMyFocusIds(): Promise<Set<string>> {
  const { data } = await supabase.from("contact_focus").select("contact_id");
  return new Set((data ?? []).map((r) => r.contact_id as string));
}
