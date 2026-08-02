import { useEffect, useState } from "react";
import heroPoster from "@/assets/hero-poster.webp";

const VIDEO_ID = "g89_eCMcs_w";

// controls/modestbranding/iv_load_policy strip the player chrome; the iframe is
// also pointer-events:none and over-scaled below, so no YouTube UI can surface.
// loop needs `playlist` set to the same id — on its own it does nothing.
const PARAMS = new URLSearchParams({
  autoplay: "1",
  mute: "1",
  loop: "1",
  playlist: VIDEO_ID,
  controls: "0",
  modestbranding: "1",
  rel: "0",
  iv_load_policy: "3",
  disablekb: "1",
  fs: "0",
  playsinline: "1",
});

const SRC = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?${PARAMS}`;

/**
 * Looping worship footage behind the homepage hero, streamed from YouTube.
 *
 * The poster paints immediately and the player fades in behind it, so the hero
 * is never empty — and if YouTube is blocked or offline, the poster is simply
 * what stays. Anyone with prefers-reduced-motion keeps the still.
 */
export function HeroVideo() {
  const [loaded, setLoaded] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <>
      <img
        src={heroPoster}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {!reducedMotion && (
        <div
          aria-hidden="true"
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ opacity: loaded ? 1 : 0, transition: "opacity 1.2s ease" }}
        >
          <iframe
            src={SRC}
            title=""
            tabIndex={-1}
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setLoaded(true)}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-0 pointer-events-none"
            style={{
              // Cover the hero the way object-fit:cover would, then over-scale
              // so any residual player chrome sits outside the visible area.
              width: "max(135vw, calc(135vh * 16 / 9))",
              height: "max(135vh, calc(135vw * 9 / 16))",
            }}
          />
        </div>
      )}

      <div className="absolute inset-0 hero-overlay" />
      <div className="absolute inset-0 hero-texture pointer-events-none" />
    </>
  );
}
