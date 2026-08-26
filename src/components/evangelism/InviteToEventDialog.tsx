import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, MapPin, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { smsHref, copyText } from "@/lib/phone";
import { loadInvitableEvents, buildInvite, type InvitableEvent } from "@/lib/eventInvite";

/**
 * Pick an event, then hand the invitation to the phone's Messages app.
 *
 * The invitation is copied to the clipboard *before* the sms: link opens, and
 * that ordering is the whole design. iOS honours the body parameter on sms:
 * links inconsistently — it varies by iOS version, by whether the tap counts as
 * a direct user gesture, and historically by whether the separator was `?` or
 * `&`. Relying on it would mean a member opening Messages to an empty thread
 * with no idea what they were about to send. Copying first means the text is
 * always one paste away, and a prefill is a bonus rather than the mechanism.
 *
 * Nothing is ever sent by the website. The member's own phone sends it, from
 * their own number, in their own thread.
 */
export function InviteToEventDialog({
  open,
  onOpenChange,
  phone,
  firstName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string | null | undefined;
  firstName: string | null | undefined;
}) {
  const [events, setEvents] = useState<InvitableEvent[] | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!open || events) return;
    loadInvitableEvents().then(setEvents);
  }, [open, events]);

  const invite = async (event: InvitableEvent) => {
    setSending(event.id);
    const message = buildInvite(firstName, event);
    const copied = await copyText(message);

    // Body included as an enhancement where the platform honours it; the
    // clipboard is what makes this dependable.
    const href = smsHref(phone, message);
    setSending(null);
    onOpenChange(false);

    toast.success(copied ? "Invite copied — paste it into Messages." : "Opening Messages…", {
      duration: 5000,
    });

    if (href) {
      // Assigning location rather than window.open: iOS blocks popups from an
      // async callback, and a blocked popup would leave the member with copied
      // text and no Messages window.
      window.location.href = href;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite {firstName?.trim() || "them"} to an event</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {events === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading events…
            </p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming public events to invite anyone to yet. Once an event is approved and
              shared publicly it will appear here.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                The invitation is copied to your clipboard, then Messages opens. Paste and send —
                nothing goes out until you do.
              </p>
              <ul className="space-y-2">
                {events.map((e) => {
                  const start = new Date(e.start_at);
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => invite(e)}
                        disabled={sending !== null}
                        className="w-full border border-border p-4 text-left transition-colors hover:border-foreground/40 disabled:opacity-60"
                      >
                        <div className="font-display text-lg leading-tight">{e.title}</div>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3 w-3" />
                            {start.toLocaleString("en-US", {
                              timeZone: "America/New_York",
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                          {e.location && (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="h-3 w-3" /> {e.location}
                            </span>
                          )}
                        </div>
                        {sending === e.id && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-accent">
                            <Check className="h-3 w-3" /> Copying…
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
