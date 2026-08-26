import { useState } from "react";
import { Phone, MessageSquare, CalendarHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { telHref, smsHref, isDialable } from "@/lib/phone";
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
  phone,
  firstName,
  size = "default",
  showInvite = true,
  className = "",
}: {
  phone: string | null | undefined;
  firstName: string | null | undefined;
  size?: "default" | "sm";
  showInvite?: boolean;
  className?: string;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);

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
          <a href={sms}>
            <MessageSquare className="mr-1.5 h-4 w-4" /> Text
          </a>
        </Button>

        <Button asChild size={size} variant="outline" className={`rounded-none ${btn}`}>
          <a href={tel}>
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
          phone={phone}
          firstName={firstName}
        />
      )}
    </>
  );
}
