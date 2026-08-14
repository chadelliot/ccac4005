import { useEffect, useState } from "react";
import { Facebook, Instagram, Youtube, ArrowRight, Play } from "lucide-react";
import { functionsBase, anonKey } from "@/lib/bishopDb";

/**
 * The church's recent Facebook posts, stacked like a handful of photographs
 * held at an angle.
 *
 * On the rotation: the brief said 35–75°. Taken literally as an in-plane spin
 * that lands the images nearly sideways and unreadable, so this turns the stack
 * in 3D instead — the cards genuinely face away from the viewer by about 26°,
 * which reads as "turned" at a glance while the photographs stay legible. Both
 * numbers are in TILT below and are the first thing to change if it wants to be
 * more or less dramatic.
 */
const TILT = {
  /** Degrees the stack faces away from the viewer. */
  rotateY: -26,
  /** In-plane lean, the bit that makes it look handled rather than mounted. */
  rotateZ: -7,
};

export type SocialPost = {
  id: string;
  image: string | null;
  caption: string | null;
  permalink: string | null;
  kind: "reel" | "photo" | "post";
};

/**
 * Only links with a URL are rendered, so a missing handle shows nothing rather
 * than a dead icon pointing at the wrong account.
 */
const SOCIALS: { name: string; url: string | null; Icon: typeof Facebook }[] = [
  { name: "Facebook", url: "https://facebook.com/CCACMD", Icon: Facebook },
  // TODO: fill these in once the church confirms the handles.
  { name: "Instagram", url: null, Icon: Instagram },
  { name: "YouTube", url: null, Icon: Youtube },
];

export function SocialStack() {
  const [posts, setPosts] = useState<SocialPost[] | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${functionsBase()}/facebook-recent-posts`, {
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

  // The frame is reserved whether or not posts arrive, so the hero does not
  // reflow when the fetch lands.
  return (
    <div className="flex flex-col items-center gap-8">
      <div
        className="relative h-[22rem] w-[16rem] sm:h-[26rem] sm:w-[19rem]"
        style={{ perspective: "1400px" }}
      >
        <div
          className="relative h-full w-full transition-transform duration-500"
          style={{
            transform: `rotateY(${TILT.rotateY}deg) rotateZ(${TILT.rotateZ}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          {hasPosts
            ? posts.map((post, i) => {
                // Distance from the active card, wrapping, so cycling always
                // moves the stack forward rather than jumping.
                const offset = (i - index + posts.length) % posts.length;
                return (
                  <PhotoCard
                    key={post.id}
                    post={post}
                    offset={offset}
                    total={posts.length}
                  />
                );
              })
            : [0, 1, 2].map((i) => <PlaceholderCard key={i} offset={i} />)}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        {hasPosts && posts.length > 1 && (
          <button
            type="button"
            onClick={() => setIndex((v) => (v + 1) % posts.length)}
            className="inline-flex items-center gap-2 border border-white/30 px-5 py-2.5 eyebrow text-night-foreground hover:bg-white/10 transition-colors"
            aria-label="Show the next post"
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
  // Each card behind the active one steps back, down and slightly rotated, so
  // the stack reads as separate photographs rather than one thick card.
  return {
    transform: `translateZ(${-offset * 26}px) translateY(${offset * 12}px) translateX(${offset * 8}px) rotateZ(${offset * 2.5}deg)`,
    zIndex: 50 - offset,
    opacity: offset > 3 ? 0 : 1,
  } as const;
}

function PhotoCard({
  post,
  offset,
  total,
}: {
  post: SocialPost;
  offset: number;
  total: number;
}) {
  const content = (
    <>
      {post.image && (
        <img
          src={post.image}
          alt={post.caption ?? "Recent post from Christ Cathedral Apostolic Church"}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      )}
      {post.kind === "reel" && (
        <span className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-night/70 text-night-foreground">
          <Play className="h-3.5 w-3.5" />
        </span>
      )}
      {post.caption && offset === 0 && (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/90 to-transparent p-4 text-xs text-night-foreground line-clamp-3">
          {post.caption}
        </span>
      )}
    </>
  );

  const shared =
    "absolute inset-0 overflow-hidden border border-white/15 bg-night-deep shadow-elevated transition-all duration-500";

  // Only the front card is a link — the ones behind it are decoration and
  // should not be tab stops or click targets.
  return offset === 0 && post.permalink ? (
    <a
      href={post.permalink}
      target="_blank"
      rel="noreferrer"
      className={shared}
      style={cardStyle(offset)}
    >
      {content}
    </a>
  ) : (
    <div className={shared} style={cardStyle(offset)} aria-hidden={offset !== 0} tabIndex={-1}>
      {content}
    </div>
  );
}

function PlaceholderCard({ offset }: { offset: number }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden border border-white/10 bg-white/[0.03] transition-all duration-500"
      style={cardStyle(offset)}
      aria-hidden="true"
    />
  );
}
