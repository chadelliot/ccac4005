// Recent posts from the church's Facebook Page, for the homepage hero.
//
// Public and read-only. The Page access token stays in Supabase secrets and is
// never shipped to the browser; this returns only what is already public on the
// Page — an image, a caption and a link.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Christ Cathedral Apostolic Church Baltimore — facebook.com/CCACMD.
// A Page ID is public metadata, so it is safe in source control.
const PAGE_ID = "2003862829873429";
const LIMIT = 5;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      // Posts change a few times a week at most. Cache hard enough that the
      // homepage does not hit Graph on every visit.
      "Cache-Control": "public, max-age=900, s-maxage=900",
    },
  });
}

type Post = {
  id: string;
  image: string | null;
  caption: string | null;
  permalink: string | null;
  createdAt: string | null;
  kind: "reel" | "photo" | "post";
};

/** Graph returns the media in several shapes depending on the post type. */
function pickImage(p: Record<string, unknown>): string | null {
  if (typeof p.full_picture === "string") return p.full_picture;
  const att = (p.attachments as { data?: Record<string, unknown>[] } | undefined)?.data?.[0];
  const media = att?.media as { image?: { src?: string } } | undefined;
  if (media?.image?.src) return media.image.src;
  const sub = (att?.subattachments as { data?: Record<string, unknown>[] } | undefined)?.data?.[0];
  const subMedia = sub?.media as { image?: { src?: string } } | undefined;
  return subMedia?.image?.src ?? null;
}

function classify(p: Record<string, unknown>): Post["kind"] {
  const att = (p.attachments as { data?: Record<string, unknown>[] } | undefined)?.data?.[0];
  const type = String(att?.type ?? "");
  if (/video|reel/i.test(type)) return "reel";
  if (/photo|album/i.test(type)) return "photo";
  return "post";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = Deno.env.get("FACEBOOK_PAGE_ACCESS_TOKEN");
  if (!token) {
    return json({ ok: false, configured: false, posts: [], error: "no_token" });
  }

  try {
    const fields = [
      "id",
      "message",
      "created_time",
      "permalink_url",
      "full_picture",
      "attachments{type,media,subattachments}",
    ].join(",");

    const url =
      `https://graph.facebook.com/v21.0/${PAGE_ID}/posts` +
      `?fields=${encodeURIComponent(fields)}&limit=${LIMIT * 3}&access_token=${encodeURIComponent(token)}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || data.error) {
      // Surface Graph's own message. An expired or wrongly-scoped Page token is
      // the usual cause and it is worth being able to read that from the
      // response rather than guessing.
      console.error("facebook-recent-posts: graph rejected", JSON.stringify(data.error ?? data));
      return json(
        {
          ok: false,
          configured: true,
          posts: [],
          error: data?.error?.message ?? `graph_${res.status}`,
          errorType: data?.error?.type ?? null,
          errorCode: data?.error?.code ?? null,
        },
        200, // Not a server error — the homepage just renders nothing.
      );
    }

    const posts: Post[] = (data.data ?? [])
      .map((p: Record<string, unknown>) => ({
        id: String(p.id),
        image: pickImage(p),
        caption: typeof p.message === "string" ? p.message.slice(0, 180) : null,
        permalink: typeof p.permalink_url === "string" ? p.permalink_url : null,
        createdAt: typeof p.created_time === "string" ? p.created_time : null,
        kind: classify(p),
      }))
      // A post with no image cannot go in a photo frame.
      .filter((p: Post) => Boolean(p.image))
      .slice(0, LIMIT);

    return json({ ok: true, configured: true, posts, checkedAt: new Date().toISOString() });
  } catch (err) {
    console.error("facebook-recent-posts failed", err);
    return json({ ok: false, configured: true, posts: [], error: "network" });
  }
});
