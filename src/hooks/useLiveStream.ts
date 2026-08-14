import { useEffect, useState } from "react";

export type FacebookVideo = {
  /** False when Facebook's rights matching has blocked off-platform embedding.
   *  Absent on older responses, so callers must treat undefined as embeddable. */
  embeddable?: boolean;
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  permalinkUrl: string;
  embedUrl: string;
  createdTime: string | null;
};

export type LiveStreamStatus = {
  ok: boolean;
  configured: boolean;
  isLive: boolean;
  liveVideo: FacebookVideo | null;
  latestVideo: FacebookVideo | null;
  checkedAt: string | null;
  error?: string;
};

const initialStatus: LiveStreamStatus = {
  ok: true,
  configured: false,
  isLive: false,
  liveVideo: null,
  latestVideo: null,
  checkedAt: null,
};

function getStatusEndpoint() {
  const explicit = import.meta.env.VITE_FACEBOOK_LIVE_STATUS_URL as string | undefined;
  if (explicit) return explicit;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl) return null;

  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/facebook-live-status`;
}

export function useLiveStream(pollMs = 60_000) {
  const [status, setStatus] = useState<LiveStreamStatus>(initialStatus);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const endpoint = getStatusEndpoint();
    if (!endpoint) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

    const load = async () => {
      try {
        const response = await fetch(endpoint, {
          cache: "no-store",
          headers: anonKey ? { apikey: anonKey } : undefined,
        });

        if (!response.ok) throw new Error(`Live status request failed (${response.status})`);

        const data = (await response.json()) as LiveStreamStatus;
        if (!cancelled) setStatus(data);
      } catch (error) {
        if (!cancelled) {
          setStatus((current) => ({
            ...current,
            ok: false,
            error: error instanceof Error ? error.message : "Could not load livestream status",
          }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(load, pollMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pollMs]);

  return { status, loading };
}
