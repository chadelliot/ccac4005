#!/usr/bin/env node
/**
 * Crop a square headshot from a full-length portrait, for the circular frame on
 * a leader's page.
 *
 *   node scripts/make-portrait-crop.mjs <source> <output.webp> [--top 0.03] [--height 0.34] [--center 0.42]
 *
 * The three numbers are fractions of the source image, so the same values work
 * whatever resolution the photographer supplies:
 *
 *   --top      where the crop starts, as a fraction of image height
 *   --height   how tall the crop is, as a fraction of image height
 *   --center   horizontal centre of the face, as a fraction of image width
 *   --pad-top  add canvas above first, as a fraction of image height, filled
 *              with the photograph's own top-left colour. For a portrait shot
 *              tight to the top edge there is no headroom to crop into, and a
 *              head pressed against the rim of a circle looks like a mistake.
 *
 * The crop is forced square from --height, so the circular mask never distorts
 * the face. It is also clamped to the image bounds: a crop that would run off
 * the top is pushed down rather than silently producing a shorter, non-square
 * output — which is how you end up with a head cut off by the circle.
 */
import sharp from "sharp";

const [, , src, out, ...rest] = process.argv;
if (!src || !out) {
  console.error("usage: make-portrait-crop.mjs <source> <output.webp> [--top n] [--height n] [--center n]");
  process.exit(1);
}

const arg = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(rest[i + 1]);
};

const topFrac = arg("top", 0.03);
const heightFrac = arg("height", 0.34);
const centerFrac = arg("center", 0.5);
/** Output edge length. 900 is comfortably past 2x the 288-360px frame. */
const SIZE = arg("size", 900);
const padTopFrac = arg("pad-top", 0);

let working = src;

if (padTopFrac > 0) {
  const src0 = sharp(src);
  const m0 = await src0.metadata();
  const pad = Math.round(m0.height * padTopFrac);
  // Replicate the top row of pixels upward rather than filling with one sampled
  // colour. A studio backdrop is rarely flat — this one is lighter behind the
  // head than at the corners — so a single colour leaves a visible band, while
  // copying the edge continues whatever gradient is actually there.
  working = await sharp(src)
    .extend({ top: pad, extendWith: "copy" })
    .png()
    .toBuffer();
  console.log(`  padded     ${pad}px above by replicating the top edge`);
}

const image = sharp(working);
const meta = await image.metadata();
const { width: W, height: H } = meta;

let side = Math.round(H * heightFrac);
// A square crop cannot be wider than the image.
side = Math.min(side, W, H);

let top = Math.round(H * topFrac);
let left = Math.round(W * centerFrac - side / 2);

// Clamp. Pushing the window back inside the frame keeps the crop square; the
// alternative — shrinking it — is what silently clips a head.
const clamp = (v, max) => Math.max(0, Math.min(v, max));
top = clamp(top, H - side);
left = clamp(left, W - side);

await sharp(working)
  .extract({ left, top, width: side, height: side })
  .resize(SIZE, SIZE, { fit: "cover" })
  .webp({ quality: 88 })
  .toFile(out);

const result = await sharp(out).metadata();
console.log(`  source     ${W}x${H}`);
console.log(`  crop       ${side}x${side} at (${left}, ${top})`);
console.log(`  head room  ${((top / H) * 100).toFixed(1)}% of image height above the crop`);
console.log(`  output     ${result.width}x${result.height}  ${out}`);
