/**
 * A line-art road running down the right-hand side of the welcome section.
 *
 * It enters at the top edge where the hero ends, sweeps down behind the visit
 * graphic, and leaves through the bottom edge into the band below — so it reads
 * as a road passing through rather than a motif that stops abruptly.
 *
 * It stays right of roughly x=520 in the viewBox, which is the gutter between
 * the two columns. That is deliberate: the copy and buttons live in the left
 * column and the road must never run through text. The graphic itself sits
 * above this in the stacking order, so the road disappears behind it and
 * reappears below, which is what sells it as one continuous route.
 *
 * preserveAspectRatio="none" lets the geometry stretch to whatever height the
 * section takes, which is what guarantees it meets both edges. That would
 * normally squash the stroke too, so every path carries
 * vector-effect="non-scaling-stroke" and the line stays an even weight.
 *
 * Purely decorative: behind the content, hidden from assistive technology, and
 * never takes a click.
 */
export function RoadLines({ className = "" }: { className?: string }) {
  const stroke = {
    stroke: "currentColor",
    strokeWidth: 1.5,
    vectorEffect: "non-scaling-stroke" as const,
    fill: "none",
  };

  return (
    <svg
      viewBox="0 0 1000 600"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      style={{ color: "var(--gold-deep)" }}
    >
      {/* The two carriageways. Both start above the top edge and finish below the
          bottom one so neither end shows a cut. */}
      <path d="M916 -20 C 872 116, 742 236, 676 372 C 640 452, 626 536, 634 620" {...stroke} strokeOpacity={0.45} />
      <path d="M846 -20 C 800 122, 668 242, 602 378 C 566 458, 552 540, 560 620" {...stroke} strokeOpacity={0.45} />

      {/* Centre line, dashed the way a road is. */}
      <path
        d="M881 -20 C 836 119, 705 239, 639 375 C 603 455, 589 538, 597 620"
        {...stroke}
        strokeOpacity={0.34}
        strokeDasharray="16 20"
      />

      {/* A side road joining from the right edge, so it reads as a route rather
          than a single ribbon. Stops well short of the gutter. */}
      <path d="M1020 300 C 940 322, 860 344, 742 366" {...stroke} strokeWidth={1.25} strokeOpacity={0.24} />
    </svg>
  );
}
