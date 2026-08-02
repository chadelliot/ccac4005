import { useEffect, useRef, useState } from "react";
import heroVideo from "@/assets/hero.mp4";
import heroPoster from "@/assets/hero-poster.webp";

/**
 * Looping, muted worship footage behind the homepage hero.
 *
 * The poster renders immediately and the video fades in once it can play, so
 * the hero never flashes empty on a slow connection. Anyone with
 * prefers-reduced-motion set keeps the still.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Some browsers pause muted autoplay when the tab is backgrounded and do not
  // resume on return; nudge it so the loop keeps running for the whole visit.
  useEffect(() => {
    if (reducedMotion) return;
    const el = ref.current;
    if (!el) return;
    // If the video was already buffered when this mounted, `canplay` has
    // already fired and the React handler would never see it.
    if (el.readyState >= 3) setReady(true);

    const play = () => {
      const p = el.play();
      if (p) p.catch(() => {});
    };
    play();
    const onVisible = () => {
      if (!document.hidden) play();
    };
    document.addEventListener("visibilitychange", onVisible);
    el.addEventListener("pause", play);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      el.removeEventListener("pause", play);
    };
  }, [reducedMotion]);

  return (
    <>
      <img
        src={heroPoster}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {!reducedMotion && (
        <video
          ref={ref}
          src={heroVideo}
          poster={heroPoster}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          onCanPlay={() => setReady(true)}
          style={{ opacity: ready ? 1 : 0, transition: "opacity 1s ease" }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 hero-overlay" />
      <div className="absolute inset-0 hero-texture pointer-events-none" />
    </>
  );
}
