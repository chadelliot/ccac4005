/**
 * Line-art roads converging toward the visit graphic.
 *
 * Inline SVG rather than an image: it stays crisp at any size, weighs a few
 * hundred bytes, and takes its colour from the brand token so it never has to
 * be re-exported when the palette moves.
 *
 * Purely decorative — it fills the white space beside the welcome copy and
 * carries the "roads leading here" idea. It sits behind everything, is hidden
 * from assistive technology, and never intercepts a click.
 */
export function RoadLines({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 500"
      fill="none"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      style={{ color: "var(--gold-deep)" }}
    >
      {/* Two carriageways sweeping in from the lower left and converging toward
          the upper right, where the graphic sits. */}
      <path
        d="M-20 470 C 140 430, 250 360, 330 262 C 392 186, 470 130, 600 96"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.5"
      />
      <path
        d="M-20 500 C 160 456, 286 372, 372 268 C 432 196, 500 152, 600 130"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.5"
      />

      {/* Centre line, dashed the way a road is. */}
      <path
        d="M-20 486 C 150 444, 268 366, 351 265 C 412 191, 486 141, 600 113"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.42"
        strokeDasharray="14 18"
      />

      {/* A side road joining, so it reads as a route rather than a ribbon. */}
      <path
        d="M96 500 C 150 420, 214 366, 300 330"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeOpacity="0.3"
      />

      {/* Destination marker where the roads arrive. */}
      <g strokeOpacity="0.55" stroke="currentColor" strokeWidth="1.5">
        <path d="M523 92 c0 14 -16 26 -16 26 s-16 -12 -16 -26 a16 16 0 0 1 32 0z" />
        <circle cx="507" cy="92" r="5" />
      </g>
    </svg>
  );
}
