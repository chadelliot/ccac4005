import { supabase } from "@/integrations/supabase/client";

export type ActivityKind = "text" | "call" | "invite";

export type ContactActivityRow = {
  id: string;
  kind: ActivityKind;
  event_id: string | null;
  event_title: string | null;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
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
    .select("id, kind, event_id, event_title, created_at, actor_id, profiles(display_name)")
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
      actor_id: row.actor_id,
      actor_name: resolved?.display_name ?? null,
    };
  });
}
