import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Guest = { first_name: string | null; response: string; is_member: boolean; party_size: number };

/**
 * Who's coming, for anyone with the event link.
 *
 * Reads through the `event_guest_list` function rather than the RSVP tables.
 * Those hold email addresses, and no RLS policy can return one column while
 * withholding another — opening them for reads would publish the email of
 * every person who RSVP'd to a church event. The function's return type has no
 * email column at all, so there is nothing to leak even by accident.
 *
 * First names only, for the same reason: enough for someone to recognise their
 * friends are going, not enough to identify a stranger's household.
 */
export function EventGuestList({ eventId }: { eventId: string }) {
  const [guests, setGuests] = useState<Guest[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.rpc("event_guest_list", { _event_id: eventId });
      if (active) setGuests((data as Guest[] | null) ?? []);
    })();
    return () => {
      active = false;
    };
  }, [eventId]);

  if (!guests || guests.length === 0) return null;

  const going = guests.filter((g) => g.response === "going");
  const maybe = guests.filter((g) => g.response === "maybe");

  // Head count, not reply count. A family of five replying once is five seats,
  // five meals and five giveaways — the number a planner actually needs.
  const headcount = (list: Guest[]) => list.reduce((n, g) => n + (g.party_size || 1), 0);
  const goingHeads = headcount(going);
  const maybeHeads = headcount(maybe);
  const extraGuests = goingHeads - going.length;

  return (
    <section className="border border-border bg-card p-6">
      <div className="eyebrow text-gold-deep mb-4 flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5" />— Who's coming
      </div>

      <div className="flex items-baseline gap-4">
        <div>
          <span className="font-display text-3xl">{goingHeads}</span>
          <span className="ml-1.5 text-sm text-muted-foreground">going</span>
        </div>
        {maybeHeads > 0 && (
          <div>
            <span className="font-display text-2xl text-muted-foreground">{maybeHeads}</span>
            <span className="ml-1.5 text-sm text-muted-foreground">maybe</span>
          </div>
        )}
      </div>

      {extraGuests > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {going.length} {going.length === 1 ? "reply" : "replies"}, bringing {extraGuests}{" "}
          {extraGuests === 1 ? "guest" : "guests"}
        </p>
      )}

      {going.length > 0 && <NameRow guests={going} />}
      {maybe.length > 0 && (
        <div className="mt-4">
          <div className="eyebrow mb-2 text-[10px] text-muted-foreground">Maybe</div>
          <NameRow guests={maybe} muted />
        </div>
      )}
    </section>
  );
}

function NameRow({ guests, muted = false }: { guests: Guest[]; muted?: boolean }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {guests.map((g, i) => (
        <li
          key={i}
          className={`flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 ${
            muted ? "opacity-70" : ""
          }`}
        >
          <span
            aria-hidden="true"
            className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-[11px] font-semibold uppercase"
          >
            {/* Someone who left the name blank still counts toward the total —
                they just have no initial to show. */}
            {g.first_name?.[0] ?? "?"}
          </span>
          <span className="text-sm">
            {g.first_name ?? "Guest"}
            {g.party_size > 1 && (
              <span className="ml-1 text-muted-foreground">+{g.party_size - 1}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
