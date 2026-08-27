import { supabase } from "@/integrations/supabase/client";

export type ActivityKind = "text" | "call" | "invite" | "note";

export type ContactActivityRow = {
  id: string;
  kind: ActivityKind;
  event_id: string | null;
  event_title: string | null;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
  note: string | null;
  /** Null until the note has been revised; the panel marks the difference. */
  updated_at: string | null;
};

/**
 * Record that someone reached out — and be honest about what that means.
 *
 * Text and Call hand off to the phone's own apps, so there is no delivery
 * receipt to store. What this records is the press: who, which contact, when,
 * and for an invite, which event. Someone can press Text and then think better
 * of it in Messages, so the log says outreach was attempted, not that a message
 * landed. The panel wording carries that caveat.
 *
 * Never throws and never blocks. It is called on the way to opening Messages or
 * the dialer, and a logging failure must not cost anyone the call they were
 * about to make — the outreach matters more than the bookkeeping.
 */
export async function logContactActivity(input: {
  contactId: string;
  kind: ActivityKind;
  event?: { id: string | null; title: string };
}): Promise<boolean> {
  try {
    // getSession reads the locally cached session; getUser would make a network
    // round trip on a code path that is racing a phone app opening.
    const { data } = await supabase.auth.getSession();
    const actorId = data.session?.user?.id;
    if (!actorId) return false;

    const { error } = await supabase.from("contact_activity").insert({
      contact_id: input.contactId,
      actor_id: actorId,
      kind: input.kind,
      event_id: input.event?.id ?? null,
      event_title: input.event?.title ?? null,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function loadContactActivity(contactId: string): Promise<ContactActivityRow[]> {
  const { data, error } = await supabase
    .from("contact_activity")
    .select(
      "id, kind, event_id, event_title, note, updated_at, created_at, actor_id, profiles(display_name)",
    )
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((row) => {
    // PostgREST returns the embedded profile as an object for a many-to-one
    // relationship, but older shapes hand back a single-element array. Handle
    // both rather than trusting one and rendering "undefined" beside a name.
    const profile = row.profiles as
      | { display_name: string | null }
      | { display_name: string | null }[]
      | null;
    const resolved = Array.isArray(profile) ? profile[0] : profile;
    return {
      id: row.id,
      kind: row.kind as ActivityKind,
      event_id: row.event_id,
      event_title: row.event_title,
      created_at: row.created_at,
      note: row.note,
      updated_at: row.updated_at,
      actor_id: row.actor_id,
      actor_name: resolved?.display_name ?? null,
    };
  });
}

/**
 * Write a note onto the timeline.
 *
 * A note is an entry like any other, which is the point: the panel can answer
 * "when did anyone last speak to this man, and how did it go?" in one column
 * instead of a date in one place and a paragraph in another. The old single
 * textarea overwrote last month's conversation with this week's and left no
 * sign either had happened.
 *
 * Notes are admins-only, in the database as well as the interface — the insert
 * policy checks the role, so a member's browser cannot write one whatever the
 * page decides to render.
 */
export async function addContactNote(contactId: string, note: string): Promise<string | null> {
  const text = note.trim();
  if (!text) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const actorId = data.session?.user?.id;
    if (!actorId) return null;

    // Returns the id rather than a bare success flag: a follow-up created from
    // this note has to point back at it, and the caller cannot ask for the row
    // afterwards without guessing which one it was.
    const { data: row, error } = await supabase
      .from("contact_activity")
      .insert({ contact_id: contactId, actor_id: actorId, kind: "note", note: text })
      .select("id")
      .single();
    return error ? null : (row?.id ?? null);
  } catch {
    return null;
  }
}

/**
 * Commit to coming back to this soul, about this note.
 *
 * The note travels with the task. On the day, the queue can say what the
 * follow-up is actually about instead of "Touch 2, due Thursday" — which tells
 * you to ring someone and nothing about why.
 *
 * touch_number continues that contact's sequence rather than being capped at
 * three: follow-ups are created by hand now, as often as the work needs.
 */
export async function createFollowUpFromNote(input: {
  contactId: string;
  activityId: string | null;
  dueDate: string;
}): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return false;

    const { data: existing } = await supabase
      .from("contact_follow_ups")
      .select("touch_number")
      .eq("contact_id", input.contactId)
      .order("touch_number", { ascending: false })
      .limit(1);
    const next = ((existing?.[0]?.touch_number as number | undefined) ?? 0) + 1;

    const { error } = await supabase.from("contact_follow_ups").insert({
      contact_id: input.contactId,
      assigned_to: userId,
      due_date: input.dueDate,
      touch_number: next,
      activity_id: input.activityId,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Correct a note already on the timeline.
 *
 * Only the note text moves. The database refuses everything else on a note row
 * — its date, its author, which contact it belongs to — so a correction cannot
 * turn into a rewrite of when the conversation happened. The edited stamp is
 * set by a trigger rather than sent from here, so it cannot be suppressed by
 * whoever is doing the editing.
 */
export async function updateContactNote(activityId: string, note: string): Promise<boolean> {
  const text = note.trim();
  if (!text) return false;
  const { error } = await supabase
    .from("contact_activity")
    .update({ note: text })
    .eq("id", activityId);
  return !error;
}
