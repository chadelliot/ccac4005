// Public edge function for the website livestream page.
// Facebook credentials stay in Supabase secrets and are never shipped to the browser.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GraphVideo = {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  permalink_url?: string;
  creation_time?: string;
};

type GraphResponse = {
  data?: GraphVideo[];
  error?: { message?: string; type?: string; code?: number };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30, s-maxage=30",
    },
  });
}

function normalizeFacebookUrl(value?: string) {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return `https://www.facebook.com${value}`;
  return `https://www.facebook.com/${value}`;
}

function toPublicVideo(video?: GraphVideo) {
  if (!video) return null;
  const permalinkUrl = normalizeFacebookUrl(video.permalink_url);
  if (!permalinkUrl) return null;

  return {
    id: video.id,
    title: video.title ?? null,
    description: video.description ?? null,
    status: video.status ?? "UNKNOWN",
    permalinkUrl,
    embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(permalinkUrl)}&show_text=false&width=1280`,
    createdTime: video.creation_time ?? null,
  };
}

async function getVideos({
  graphBase,
  pageId,
  accessToken,
  broadcastStatus,
}: {
  graphBase: string;
  pageId: string;
  accessToken: string;
  broadcastStatus: "LIVE" | "VOD";
}) {
  const fields = "id,title,description,status,permalink_url,creation_time";
  const params = new URLSearchParams({
    broadcast_status: broadcastStatus,
    source: "owner",
    fields,
    limit: "1",
    access_token: accessToken,
  });

  const response = await fetch(`${graphBase}/${encodeURIComponent(pageId)}/live_videos?${params}`);
  const body = (await response.json()) as GraphResponse;

  if (!response.ok || body.error) {
    console.error("Facebook Graph API live status request failed", {
      status: response.status,
      code: body.error?.code,
      type: body.error?.type,
      message: body.error?.message,
    });
    throw new Error("Facebook livestream status is temporarily unavailable");
  }

  return body.data ?? [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);

  const pageId = Deno.env.get("FACEBOOK_PAGE_ID");
  const accessToken = Deno.env.get("FACEBOOK_PAGE_ACCESS_TOKEN");
  const graphVersion = Deno.env.get("FACEBOOK_GRAPH_API_VERSION") ?? "v25.0";

  if (!pageId || !accessToken) {
    return json({
      ok: true,
      configured: false,
      isLive: false,
      liveVideo: null,
      latestVideo: null,
      checkedAt: new Date().toISOString(),
    });
  }

  const graphBase = `https://graph.facebook.com/${graphVersion}`;

  try {
    const liveVideos = await getVideos({
      graphBase,
      pageId,
      accessToken,
      broadcastStatus: "LIVE",
    });

    const liveVideo = toPublicVideo(liveVideos[0]);
    let latestVideo = null;

    if (!liveVideo) {
      const vodVideos = await getVideos({
        graphBase,
        pageId,
        accessToken,
        broadcastStatus: "VOD",
      });
      latestVideo = toPublicVideo(vodVideos[0]);
    }

    return json({
      ok: true,
      configured: true,
      isLive: Boolean(liveVideo),
      liveVideo,
      latestVideo,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("facebook-live-status error:", error);
    return json(
      {
        ok: false,
        configured: true,
        isLive: false,
        liveVideo: null,
        latestVideo: null,
        checkedAt: new Date().toISOString(),
        error: "Livestream status is temporarily unavailable",
      },
      502,
    );
  }
});
