import { useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mark a soul as one to concentrate on.
 *
 * Optimistic: the star fills the instant it is pressed and rolls back if the
 * write fails. This gets used walking between doors on a phone, where waiting
 * on a round trip to see whether a tap registered is how you end up tapping
 * twice and turning it back off.
 *
 * The caller decides whether to render this at all — see canFocusContact. A
 * disabled star still reads as an invitation, and the honest answer for someone
 * who cannot change it is not to show a control.
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

  const toggle = async () => {
    if (busy) return;
    const next = !on;
    setOn(next);
    setBusy(true);

    const { error } = await supabase
      .from("evangelism_contacts")
      .update({ is_focus: next })
      .eq("id", contactId);

    setBusy(false);
    if (error) {
      setOn(!next); // put the star back where it was
      toast.error("Couldn't change focus — you may not have permission.");
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
      aria-label={on ? "Remove from focus" : "Add to focus"}
      title={on ? "In focus — press to remove" : "Mark as a focus contact"}
      className={`inline-flex shrink-0 items-center gap-1.5 text-xs transition-colors ${
        on ? "text-accent" : "text-muted-foreground hover:text-foreground"
      } ${busy ? "opacity-60" : ""}`}
    >
      <Star className={icon} fill={on ? "currentColor" : "none"} />
      {withLabel && <span className="eyebrow">{on ? "In focus" : "Focus"}</span>}
    </button>
  );
}
