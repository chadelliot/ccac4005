/**
 * A line-art road running the full height of the welcome section.
 *
 * It enters at the top edge — where the hero ends — sweeps down and left across
 * the background behind the copy, passes below the buttons, and leaves through
 * the bottom edge, so it reads as one road carrying on past the section rather
 * than a motif parked beside the graphic.
 *
 * preserveAspectRatio="none" lets the geometry stretch to whatever height the
 * section ends up, which is what guarantees it meets both edges. That would
 * normally squash the stroke along with it, so every path carries
 * vector-effect="non-scaling-stroke" and stays an even weight.
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
      {/* The two carriageways. They start above the top edge and finish below
          the bottom one so neither end shows a cut. */}
      <path d="M832 -20 C 706 118, 566 212, 404 302 C 282 370, 192 474, 150 620" {...stroke} strokeOpacity={0.45} />
      <path d="M762 -20 C 640 132, 498 224, 338 314 C 222 384, 128 484, 86 620" {...stroke} strokeOpacity={0.45} />

      {/* Centre line, dashed the way a road is. */}
      <path
        d="M797 -20 C 673 125, 532 218, 371 308 C 252 377, 160 479, 118 620"
        {...stroke}
        strokeOpacity={0.34}
        strokeDasharray="16 20"
      />

      {/* A side road joining from the right, so it reads as a route rather than
          a single ribbon. */}
      <path d="M1020 250 C 880 286, 700 330, 470 372" {...stroke} strokeWidth={1.25} strokeOpacity={0.24} />
    </svg>
  );
}
