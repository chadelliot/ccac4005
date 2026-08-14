// Recent Instagram posts for the homepage row.
//
// Public and read-only. Reads through the Facebook Page the Instagram account
// is linked to, using the same Page token as the other Facebook functions — so
// no separate Instagram credential exists to manage.
//
// REQUIREMENTS, which are all on the Meta side rather than in this code:
//   1. @ccacbaltimore is a Business or Creator account, not personal.
//   2. It is linked to the CCAC Facebook Page.
//   3. FACEBOOK_PAGE_ACCESS_TOKEN carries the `instagram_basic` permission.
//
// Any of those missing produces a clear `reason` in the response rather than an
// error, so the homepage can stay quiet instead of showing a broken row.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGE_ID = "2003862829873429";
const LIMIT = 8;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=900, s-maxage=900",
    },
  });
}

type IgPost = {
  id: string;
  image: string | null;
  caption: string | null;
  permalink: string | null;
  kind: "reel" | "video" | "image" | "album";
  timestamp: string | null;
};

function classify(t: string | undefined): IgPost["kind"] {
  switch (t) {
    case "VIDEO":
      return "video";
    case "CAROUSEL_ALBUM":
      return "album";
    default:
      return "image";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = Deno.env.get("FACEBOOK_PAGE_ACCESS_TOKEN");
  if (!token) return json({ ok: false, posts: [], reason: "no_token" });

  try {
    // Step one: find the Instagram account behind the Page.
    const linkRes = await fetch(
      `https://graph.facebook.com/v21.0/${PAGE_ID}?fields=instagram_business_account&access_token=${encodeURIComponent(token)}`,
    );
    const link = await linkRes.json();

    if (link.error) {
      const message = String(link.error.message ?? "");
      // Distinguish "the token cannot ask" from "there is nothing to find" —
      // they need completely different fixes and both are common here.
      const reason = /instagram_basic|permission/i.test(message)
        ? "missing_instagram_permission"
        : `graph_${link.error.code ?? "error"}`;
      console.error("instagram-recent-posts: link lookup failed", message);
      return json({ ok: false, posts: [], reason, detail: message });
    }

    const igId = link?.instagram_business_account?.id;
    if (!igId) {
      return json({
        ok: false,
        posts: [],
        reason: "no_linked_account",
        detail:
          "No Instagram Business account is linked to this Facebook Page. Link it in Page settings, and make sure the Instagram account is Business or Creator rather than personal.",
      });
    }

    const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
    const mediaRes = await fetch(
      `https://graph.facebook.com/v21.0/${igId}/media?fields=${encodeURIComponent(fields)}&limit=${LIMIT}&access_token=${encodeURIComponent(token)}`,
    );
    const media = await mediaRes.json();

    if (media.error) {
      console.error("instagram-recent-posts: media fetch failed", media.error.message);
      return json({ ok: false, posts: [], reason: `graph_${media.error.code}`, detail: media.error.message });
    }

    const posts: IgPost[] = (media.data ?? [])
      .map((m: Record<string, unknown>) => ({
        id: String(m.id),
        // Video items have no still of their own; thumbnail_url is the frame.
        image: (m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url) as string | null,
        caption: typeof m.caption === "string" ? m.caption.slice(0, 140) : null,
        permalink: typeof m.permalink === "string" ? m.permalink : null,
        kind: classify(m.media_type as string | undefined),
        timestamp: typeof m.timestamp === "string" ? m.timestamp : null,
      }))
      .filter((p: IgPost) => Boolean(p.image))
      .slice(0, LIMIT);

    return json({ ok: true, posts, checkedAt: new Date().toISOString() });
  } catch (err) {
    console.error("instagram-recent-posts failed", err);
    return json({ ok: false, posts: [], reason: "network" });
  }
});
