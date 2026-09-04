import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Phone, MapPin, ChevronRight, Star, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContactActions } from "./ContactActions";
import { FocusToggle } from "./FocusToggle";
import { WitnessField } from "./WitnessField";
import { canEditContact } from "@/lib/contactPermissions";

/**
 * One soul as a card.
 *
 * Shared by the Contacts list and by the Evangelism Overview at phone widths,
 * so there is one card design rather than two that drift. That page's
 * table and this card render the same filtered array — the presentation
 * changes with the viewport, the data and the filtering do not.
 *
 * The structural prop type is deliberate: the two pages carry different row
 * shapes (the Overview also holds coordinates, the contact list does
 * not) and neither needs to know about the other's extra columns.
 */
export type ContactCardData = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  where_met: string | null;
  met_on: string | null;
  created_at: string;
  status: string;
  added_by: string;
  visited: boolean;
  baptized: boolean;
  holy_ghost: boolean;
  is_focus: boolean;
  witness_name?: string | null;
};

export function lastContactLabel(iso: string | undefined) {
  if (!iso) return null;
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  // Days for the recent past, a date once that stops being the useful unit —
  // "11 days ago" answers the question, "Jun 3" answers it for June.
  if (days <= 0) return "Contacted today";
  if (days === 1) return "Contacted yesterday";
  if (days < 30) return `Contacted ${days} days ago`;
  return `Contacted ${then.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function ContactCard({
  contact: c,
  lastContactAt,
  userId,
  canManageEvangelism,
  onFocusChange,
  onWitnessChange,
  trailing,
}: {
  contact: ContactCardData;
  lastContactAt?: string;
  userId: string | undefined;
  canManageEvangelism: boolean;
  onFocusChange: (id: string, next: boolean) => void;
  onWitnessChange?: (id: string, name: string | null) => void;
  /** Anything the host page wants in the corner — the Overview puts delete here. */
  trailing?: ReactNode;
}) {
  const label = lastContactLabel(lastContactAt);

  return (
    // The card is not one big link: Text and Call are anchors themselves, and
    // an anchor inside an anchor is invalid HTML that browsers unnest. The name
    // and the chevron carry navigation so the row can hold real actions.
    <div className="group flex flex-wrap items-start justify-between gap-4 border border-border bg-card p-5 transition-colors hover:border-foreground/30">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          {canEditContact(c.added_by, userId, canManageEvangelism) ? (
            <FocusToggle
              contactId={c.id}
              value={c.is_focus}
              size="sm"
              onChange={(next) => onFocusChange(c.id, next)}
            />
          ) : (
            c.is_focus && <Star className="h-4 w-4 shrink-0 text-accent" fill="currentColor" />
          )}
          <Link
            to="/dashboard/evangelism/$id"
            params={{ id: c.id }}
            className="font-display text-xl underline-offset-4 hover:underline"
          >
            {c.first_name} {c.last_name}
          </Link>
          {c.baptized && (
            <Badge variant="secondary" className="bg-accent/20 text-accent-foreground">
              Baptized
            </Badge>
          )}
          {c.holy_ghost && (
            <Badge variant="secondary" className="bg-night text-night-foreground">
              Holy Ghost
            </Badge>
          )}
          {c.visited && <Badge variant="outline">Visited</Badge>}
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {c.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {c.phone}
            </span>
          )}
          {c.where_met && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {c.where_met}
            </span>
          )}
          {/* Correctable here as well: on a phone this card is the contact
              list, and sending someone to the profile to fix a name they can
              see in front of them is a trip for nothing. */}
          {c.witness_name !== undefined && (
            <span className="flex items-center gap-1">
              <UserCheck className="h-3 w-3" />
              <WitnessField
                contactId={c.id}
                witnessName={c.witness_name ?? null}
                canEdit={canEditContact(c.added_by, userId, canManageEvangelism)}
                onSaved={(name) => onWitnessChange?.(c.id, name)}
              />
            </span>
          )}
          {/* The day they were witnessed to — the date the harvest list keeps
              and the one that decides which month they belong to. */}
          <span>
            {new Date((c.met_on ?? c.created_at.slice(0, 10)) + "T12:00:00").toLocaleDateString(
              undefined,
              { month: "short", day: "numeric", year: "numeric" },
            )}
          </span>
          {/* Whether anyone has been back since. A soul met in March and never
              called again should not look like one called yesterday. */}
          {label ? (
            <span className="text-foreground/70">{label}</span>
          ) : (
            <span className="italic">Not contacted yet</span>
          )}
        </div>

        <ContactActions
          contactId={c.id}
          phone={c.phone}
          firstName={c.first_name}
          status={c.status}
          size="sm"
          className="mt-3"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        <Link
          to="/dashboard/evangelism/$id"
          params={{ id: c.id }}
          className="eyebrow flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="hidden sm:inline">View</span>
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}
