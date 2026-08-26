import { useState } from "react";
import { Phone, MessageSquare, CalendarHeart, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { telHref, smsHref, isDialable } from "@/lib/phone";
import { logContactActivity } from "@/lib/contactActivity";
import { isDoNotContact } from "@/lib/contactStatus";
import { InviteToEventDialog } from "./InviteToEventDialog";

/**
 * Text, Call and Invite for one soul.
 *
 * The website never sends anything. These hand the number to the phone's own
 * Messages and Dialer, so the text comes from the member's number and lands in
 * their own thread — which is what makes a follow-up feel like a person rather
 * than a system, and why no SMS provider is involved.
 *
 * Labelled buttons rather than bare icons: this is used one-handed, outdoors,
 * by people who are not going to guess what a glyph means, and an icon-only
 * target next to "call this stranger" is not the place to save space.
 */
export function ContactActions({
  contactId,
  phone,
  firstName,
  status,
  size = "default",
  showInvite = true,
  className = "",
  onLogged,
}: {
  contactId: string;
  phone: string | null | undefined;
  firstName: string | null | undefined;
  status?: string | null;
  size?: "default" | "sm";
  showInvite?: boolean;
  className?: string;
  onLogged?: () => void;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);

  // Fire-and-forget, deliberately not awaited. These sit on anchors that are
  // about to hand the browser to Messages or the dialer, and waiting on a round
  // trip first would put a stutter between the tap and the app opening — or,
  // worse, lose the tap. A missed log entry is a smaller loss than a missed
  // call.
  const record = (kind: "text" | "call") => {
    void logContactActivity({ contactId, kind }).then((ok) => {
      if (ok) onLogged?.();
    });
  };

  // Someone asked to be left alone. Said rather than silently omitted: a blank
  // space reads as "no phone number on file" and invites someone to go add one,
  // where a stated reason closes the question. Every surface that shows contact
  // actions renders them through this component, so this is the one place the
  // rule has to hold.
  if (isDoNotContact(status)) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}
      >
        <Ban className="h-3.5 w-3.5" />
        <span>Do not contact</span>
      </div>
    );
  }

  // No number, no actions — a Call button that cannot dial is worse than none.
  if (!isDialable(phone)) return null;

  const tel = telHref(phone)!;
  const sms = smsHref(phone)!;
  const btn = size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4";

  return (
    <>
      {/* flex-wrap, not a row: at iPhone width three labelled buttons do not
          fit on one line, and wrapping beats shrinking them to nothing. */}
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <Button asChild size={size} variant="outline" className={`rounded-none ${btn}`}>
          <a href={sms} onClick={() => record("text")}>
            <MessageSquare className="mr-1.5 h-4 w-4" /> Text
          </a>
        </Button>

        <Button asChild size={size} variant="outline" className={`rounded-none ${btn}`}>
          <a href={tel} onClick={() => record("call")}>
            <Phone className="mr-1.5 h-4 w-4" /> Call
          </a>
        </Button>

        {showInvite && (
          <Button
            size={size}
            variant="outline"
            className={`rounded-none ${btn}`}
            onClick={() => setInviteOpen(true)}
          >
            <CalendarHeart className="mr-1.5 h-4 w-4" /> Invite
          </Button>
        )}
      </div>

      {showInvite && (
        <InviteToEventDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          contactId={contactId}
          phone={phone}
          firstName={firstName}
          onLogged={onLogged}
        />
      )}
    </>
  );
}
