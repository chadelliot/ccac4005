import { supabase } from "@/integrations/supabase/client";

const SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || "https://ccacbmore.com";

export type InvitableEvent = {
  id: string;
  title: string;
  start_at: string;
  location: string | null;
  /** Set for Facebook events, which have no row here and link out instead. */
  facebookUrl?: string;
};

/**
 * Upcoming events a soul could be invited to.
 *
 * Reads the church's own approved public events — deliberately not a second
 * list of "invitable" events to keep in step with the real one. Only public
 * events appear: an invitation carries a link the person is going to open
 * before they have any account, so anything not public would send them to a
 * page they cannot see.
 */
export async function loadInvitableEvents(): Promise<InvitableEvent[]> {
  const { data } = await supabase
    .from("events")
    .select("id,title,start_at,location")
    .eq("status", "approved")
    .eq("is_public", true)
    // An event that began earlier today is still worth inviting someone to.
    .gte("start_at", new Date(Date.now() - 6 * 3600_000).toISOString())
    .order("start_at", { ascending: true })
    .limit(20);
  return (data as InvitableEvent[] | null) ?? [];
}

export function eventPublicUrl(event: InvitableEvent): string {
  return event.facebookUrl ?? `${SITE_URL}/events/${event.id}`;
}

/**
 * The invitation itself.
 *
 * Written to be sent by a person, not a system: first name, plain sentences,
 * no marketing voice. This is the text someone will read on their phone from a
 * stranger who spoke to them once, and it should sound like that stranger.
 */
export function buildInvite(firstName: string | null | undefined, event: InvitableEvent): string {
  const start = new Date(event.start_at);
  const when = start.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const greeting = firstName?.trim() ? `Hey ${firstName.trim()}, ` : "Hey, ";
  const where = event.location ? ` at ${event.location}` : "";

  return (
    `${greeting}I wanted to personally invite you to ${event.title} ` +
    `at Christ Cathedral Apostolic${where} on ${when}. ` +
    `We'd love to have you with us. Details: ${eventPublicUrl(event)}`
  );
}
