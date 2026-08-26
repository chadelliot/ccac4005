import { useCallback, useEffect, useRef, useState } from "react";

/**
 * State that survives the page being reloaded underneath you.
 *
 * This exists because of what happens on a phone. Pressing Text hands the
 * browser to Messages, and iOS is free to discard the backgrounded tab under
 * memory pressure — when you switch back, Safari reloads the page from
 * scratch. Nothing the site does can prevent that eviction. What it can do is
 * come back up in the same state, so returning from a text lands you on the
 * same filtered list at the same scroll position instead of at the top of 84
 * contacts with the search box empty.
 *
 * sessionStorage rather than localStorage on purpose: this is the state of one
 * browsing session, not a preference. Closing the tab should forget it, and a
 * second tab should be free to hold a different filter.
 *
 * Storage can throw — Safari private browsing, blocked site data — and a
 * remembered scroll position is never worth a blank page, so every access is
 * wrapped and failure just means the default.
 */
function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable or full — the feature degrades, the page does not */
  }
}

export function useStickyState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => read(key, initial));

  useEffect(() => {
    write(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}

/**
 * Remember where the page was scrolled to, and go back there after a reload.
 *
 * `ready` is what makes this work rather than merely fire: the list has to be
 * on the page before a scroll offset means anything. Restoring at mount would
 * scroll a page that is still one "Loading…" line tall, and the browser would
 * clamp it to zero.
 */
export function useStickyScroll(key: string, ready: boolean) {
  const restored = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frame = 0;
    const onScroll = () => {
      // Coalesced to one write per frame; scroll fires far too often to touch
      // storage on every event.
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        write(key, window.scrollY);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [key]);

  useEffect(() => {
    if (!ready || restored.current || typeof window === "undefined") return;
    const y = read<number>(key, 0);
    restored.current = true;
    if (y <= 0) return;

    // Two frames out: the first lets React commit the rows, the second lets the
    // browser lay them out, and only then is the document tall enough to accept
    // the offset.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.scrollTo(0, y));
    });
  }, [key, ready]);
}

/** Clears a sticky value — for when a filter should not outlive its context. */
export function clearSticky(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* nothing to do */
  }
}
