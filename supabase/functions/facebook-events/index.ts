// Upcoming events from the church's Facebook Page, for the public events page.
//
// Read live rather than imported into the events table. The church asked for
// Facebook events to appear automatically, and reading them on demand means
// there is no sync job to fall behind, no duplicate rows to reconcile when an
// event is edited on Facebook, and nothing to clean up when one is deleted.
// Member-submitted events still live in the database and keep their approval
// flow; these simply appear alongside them.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGE_ID = "2003862829873429";
const LIMIT = 20;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=600, s-maxage=600",
    },
  });
}

type PublicEvent = {
  id: string;
  name: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  location: string | null;
  cover: string | null;
  permalink: string;
  source: "facebook";
};

function placeToString(place: Record<string, unknown> | undefined): string | null {
  if (!place) return null;
  const name = typeof place.name === "string" ? place.name : null;
  const loc = place.location as Record<string, unknown> | undefined;
  const parts = [loc?.city, loc?.state].filter((v) => typeof v === "string");
  if (name && parts.length) return `${name} · ${parts.join(", ")}`;
  return name ?? (parts.length ? parts.join(", ") : null);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = Deno.env.get("FACEBOOK_PAGE_ACCESS_TOKEN");
  if (!token) return json({ ok: false, events: [], reason: "no_token" });

  try {
    const fields = "id,name,description,start_time,end_time,place,cover,is_canceled";
    // `since` matters more than it looks: without it the edge returns the
    // Page's oldest events first, so a Page with any history fills the whole
    // page size with past ones and the upcoming events never appear at all.
    // Backdated slightly so an event that started this morning still counts.
    const since = Math.floor(Date.now() / 1000) - 6 * 3600;
    const url =
      `https://graph.facebook.com/v21.0/${PAGE_ID}/events` +
      `?fields=${encodeURIComponent(fields)}&since=${since}&limit=${LIMIT}` +
      `&access_token=${encodeURIComponent(token)}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      // Graph's own words. The Events edge has its own permission requirements
      // that differ from posts, so "it worked for posts" proves nothing here.
      console.error("facebook-events: graph rejected", JSON.stringify(data.error));
      return json({
        ok: false,
        events: [],
        reason: `graph_${data.error.code ?? res.status}`,
        detail: data.error.message ?? null,
      });
    }

    // How many Graph returned before any filtering. Without this, "no upcoming
    // events" and "the token cannot see events" are indistinguishable from the
    // outside, and they need completely different fixes.
    const totalFromGraph = (data.data ?? []).length;

    const now = Date.now();
    const events: PublicEvent[] = (data.data ?? [])
      .filter((e: Record<string, unknown>) => e.is_canceled !== true)
      .map((e: Record<string, unknown>) => ({
        id: String(e.id),
        name: String(e.name ?? "Event"),
        description: typeof e.description === "string" ? e.description : null,
        startAt: String(e.start_time ?? ""),
        endAt: typeof e.end_time === "string" ? e.end_time : null,
        location: placeToString(e.place as Record<string, unknown> | undefined),
        cover: ((e.cover as { source?: string } | undefined)?.source) ?? null,
        permalink: `https://www.facebook.com/events/${String(e.id)}`,
        source: "facebook" as const,
      }))
      // Past events belong in a history page, not on "Upcoming".
      .filter((e: PublicEvent) => e.startAt && new Date(e.startAt).getTime() >= now - 6 * 3600_000)
      .sort((a: PublicEvent, b: PublicEvent) => a.startAt.localeCompare(b.startAt));

    return json({ ok: true, events, totalFromGraph, checkedAt: new Date().toISOString() });
  } catch (err) {
    console.error("facebook-events failed", err);
    return json({ ok: false, events: [], reason: "network" });
  }
});
