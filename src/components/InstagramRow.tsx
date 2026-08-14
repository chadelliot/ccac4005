import { useEffect, useState } from "react";
import { Instagram, Play, Images } from "lucide-react";
import { functionsBase, anonKey } from "@/lib/bishopDb";

const HANDLE = "ccacbaltimore";
const PROFILE_URL = `https://instagram.com/${HANDLE}`;

type IgPost = {
  id: string;
  image: string | null;
  caption: string | null;
  permalink: string | null;
  kind: "reel" | "video" | "image" | "album";
};

/**
 * A full-width row of the latest Instagram posts.
 *
 * Renders nothing at all when there are no posts. The row only earns its space
 * if it is full of real photographs — an empty grid of placeholder squares on
 * the homepage is worse than the section simply not being there, and this
 * cannot fill until the Page token carries `instagram_basic`.
 */
export function InstagramRow() {
  const [posts, setPosts] = useState<IgPost[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${functionsBase()}/instagram-recent-posts`, {
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

  if (!posts || posts.length === 0) return null;

  return (
    // Top padding only: the grid is the last thing in the section, so its bottom
    // edge meets the next band directly rather than leaving a strip of night
    // blue beneath the photographs.
    <section className="bg-night text-night-foreground pt-16 lg:pt-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow text-gold">— On Instagram</div>
            <h2 className="font-display text-3xl lg:text-4xl mt-2">Life at Christ Cathedral</h2>
          </div>
          <a
            href={PROFILE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 eyebrow text-night-foreground/80 hover:text-gold transition-colors"
          >
            <Instagram className="h-4 w-4" />@{HANDLE}
          </a>
        </div>
      </div>

      {/* Full-bleed: the grid runs edge to edge rather than sitting inside the
          7xl container, so a row of eight squares reads as a filmstrip. */}
      <ul className="mt-10 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 leading-none">
        {posts.map((post) => (
          <li key={post.id} className="relative aspect-square">
            <a
              href={post.permalink ?? PROFILE_URL}
              target="_blank"
              rel="noreferrer"
              className="group block h-full w-full overflow-hidden bg-night-deep"
            >
              {post.image && (
                <img
                  src={post.image}
                  alt={post.caption ?? `Instagram post from @${HANDLE}`}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              )}
              {post.kind !== "image" && (
                <span className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-night/60">
                  {post.kind === "album" ? (
                    <Images className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current" />
                  )}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
