import { useEffect, useState } from "react";
import { Facebook, Instagram, Youtube, ArrowRight, Play, Globe, ThumbsUp, MessageCircle, Share2 } from "lucide-react";
import { functionsBase, anonKey } from "@/lib/bishopDb";
import logo from "@/assets/ccac-logo.webp";

/**
 * The church's recent Facebook posts, rendered as post cards and stacked like a
 * handful of them held at an angle.
 *
 * The cards carry Facebook's furniture — avatar, page name, timestamp, caption
 * above the media, a reaction row beneath — because a bare photograph in a
 * frame reads as a stock image, while the same photograph under a page name and
 * a timestamp reads as "this church posted this". That recognition is the whole
 * point of putting it in the hero.
 *
 * The stack leans as a group but stays flat. An earlier version rotated it in 3D
 * with a perspective, which foreshortened one edge and made the cards look bent
 * inward rather than laid on top of each other. Depth now comes from offset and
 * a slight scale step, which keeps every card square to the viewer.
 */
const LEAN = -6;

/** Bump when the post response gains or renames a field. */
const SHAPE = 2;

const PAGE_NAME = "Christ Cathedral Apostolic Church";
const PAGE_URL = "https://facebook.com/CCACMD";

export type SocialPost = {
  id: string;
  image: string | null;
  caption: string | null;
  permalink: string | null;
  videoUrl: string | null;
  createdAt: string | null;
  kind: "reel" | "photo" | "post";
};

/** Only links with a URL render, so a missing handle shows nothing rather than
 *  an icon pointing at an account that may not be the church's. */
const SOCIALS: { name: string; url: string | null; Icon: typeof Facebook }[] = [
  { name: "Facebook", url: PAGE_URL, Icon: Facebook },
  // TODO: fill in once the church confirms the handles.
  { name: "Instagram", url: null, Icon: Instagram },
  { name: "YouTube", url: null, Icon: Youtube },
];

export function SocialStack() {
  const [posts, setPosts] = useState<SocialPost[] | null>(null);
  const [index, setIndex] = useState(0);
  /** Which post is playing, if any. Only ever one — five Facebook iframes in a
   *  hero would cost more than the rest of the page put together. */
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // The endpoint caches for 15 minutes, which is right for Graph's rate
        // limits but means a change to the response *shape* stays invisible for
        // that long after a deploy — exactly how `videoUrl` appeared to be
        // missing when it was already being returned. Bump SHAPE when fields
        // are added or renamed; it varies the cache key and nothing else.
        const res = await fetch(`${functionsBase()}/facebook-recent-posts?shape=${SHAPE}`, {
          headers: { apikey: anonKey() },
        });
        const data = await res.json();
        if (active) setPosts(Array.isArray(data.posts) ? data.posts : []);
      } catch {
        if (active) setPosts([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const hasPosts = posts !== null && posts.length > 0;
  const links = SOCIALS.filter((s) => s.url);

  const advance = () => {
    setPlayingId(null); // never leave a video running behind the stack
    setIndex((v) => (v + 1) % (posts?.length ?? 1));
  };

  return (
    <div className="flex flex-col items-center gap-7">
      <div className="relative h-[27rem] w-[19rem] sm:h-[30rem] sm:w-[21rem]">
        <div
          className="relative h-full w-full transition-transform duration-500"
          style={{ transform: `rotate(${LEAN}deg)` }}
        >
          {hasPosts
            ? posts.map((post, i) => {
                const offset = (i - index + posts.length) % posts.length;
                return (
                  <PostCard
                    key={post.id}
                    post={post}
                    offset={offset}
                    playing={playingId === post.id}
                    onPlay={() => setPlayingId(post.id)}
                  />
                );
              })
            : [0, 1, 2].map((i) => <SkeletonCard key={i} offset={i} />)}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        {hasPosts && posts.length > 1 && (
          <button
            type="button"
            onClick={advance}
            className="inline-flex items-center gap-2 border border-white/30 px-5 py-2.5 eyebrow text-night-foreground hover:bg-white/10 transition-colors"
          >
            Next post <ArrowRight className="h-3.5 w-3.5" />
            <span className="text-night-foreground/50">
              {index + 1}/{posts.length}
            </span>
          </button>
        )}

        {links.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="eyebrow text-[10px] text-night-foreground/60">Follow us on</span>
            {links.map(({ name, url, Icon }) => (
              <a
                key={name}
                href={url!}
                target="_blank"
                rel="noreferrer"
                aria-label={name}
                title={name}
                className="inline-flex h-9 w-9 items-center justify-center border border-white/25 text-night-foreground/80 hover:border-gold hover:text-gold transition-colors"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function cardStyle(offset: number) {
  // Flat: no translateZ, no perspective. Cards behind step right, down, rotate a
  // touch and shrink very slightly — enough to read as a stack without any card
  // turning away from the viewer.
  return {
    transform: `translateX(${offset * 15}px) translateY(${offset * 11}px) rotate(${offset * 2.2}deg) scale(${1 - offset * 0.028})`,
    zIndex: 50 - offset,
    opacity: offset > 3 ? 0 : 1,
  } as const;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function PostCard({
  post,
  offset,
  playing,
  onPlay,
}: {
  post: SocialPost;
  offset: number;
  playing: boolean;
  onPlay: () => void;
}) {
  const front = offset === 0;
  const canPlay = Boolean(post.videoUrl);

  return (
    <article
      className="absolute inset-0 flex flex-col overflow-hidden bg-card text-foreground shadow-elevated transition-all duration-500"
      style={cardStyle(offset)}
      aria-hidden={!front}
      // Cards behind the front one are decoration; keep them out of the tab order.
      {...(front ? {} : { inert: "" as unknown as boolean })}
    >
      <header className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-2.5">
        <img src={logo} alt="" width={40} height={40} className="h-9 w-9 rounded-full object-contain bg-secondary" />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-semibold">{PAGE_NAME}</div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {relativeTime(post.createdAt)}
            <span aria-hidden="true">·</span>
            <Globe className="h-3 w-3" aria-hidden="true" />
          </div>
        </div>
      </header>

      {post.caption && (
        <p className="px-3.5 pb-2.5 text-[13px] leading-snug line-clamp-3">{post.caption}</p>
      )}

      <div className="relative flex-1 min-h-0 bg-night-deep">
        {playing && post.videoUrl ? (
          <iframe
            title={post.caption ?? "Facebook video"}
            src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(post.videoUrl)}&show_text=false&autoplay=true&width=560`}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <>
            {post.image && (
              <img
                src={post.image}
                alt={post.caption ?? "Recent post from Christ Cathedral Apostolic Church"}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
            )}
            {canPlay && front && (
              // The iframe is only created when this is pressed. Autoloading
              // five Facebook players would dominate the page's load.
              <button
                type="button"
                onClick={onPlay}
                aria-label="Play this video"
                className="absolute inset-0 grid place-items-center bg-night/25 transition-colors hover:bg-night/10"
              >
                <span className="grid h-14 w-14 place-items-center rounded-full bg-night-foreground/95 text-night shadow-elevated">
                  <Play className="h-6 w-6 translate-x-0.5 fill-current" />
                </span>
              </button>
            )}
            {canPlay && !front && (
              <span className="absolute top-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-full bg-night/60 text-night-foreground">
                <Play className="h-3 w-3 fill-current" />
              </span>
            )}
          </>
        )}
      </div>

      <footer className="border-t border-border px-3.5 py-2 flex items-center justify-between text-muted-foreground">
        <span className="flex items-center gap-4">
          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          <Share2 className="h-4 w-4" aria-hidden="true" />
        </span>
        {front && post.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-semibold text-gold-deep hover:text-foreground"
          >
            View on Facebook
          </a>
        )}
      </footer>
    </article>
  );
}

function SkeletonCard({ offset }: { offset: number }) {
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden bg-card/90 shadow-elevated"
      style={cardStyle(offset)}
      aria-hidden="true"
    >
      <div className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-2.5">
        <span className="h-9 w-9 rounded-full bg-secondary" />
        <span className="flex-1 space-y-1.5">
          <span className="block h-2.5 w-3/4 rounded bg-secondary" />
          <span className="block h-2 w-1/4 rounded bg-secondary" />
        </span>
      </div>
      <div className="flex-1 bg-secondary/70" />
      <div className="border-t border-border px-3.5 py-3">
        <span className="block h-2.5 w-1/3 rounded bg-secondary" />
      </div>
    </div>
  );
}
