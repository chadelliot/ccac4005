export type LatLng = { lat: number; lng: number };

/**
 * Split a territory into four quadrants of equal ground area.
 *
 * Mirrors the SQL that seeded the original quadrants, so redrawing the focus
 * area in the browser produces the same shapes the migration would have. Without
 * this, editing the boundary would leave four zones dividing a shape that no
 * longer exists — coverage counted against ground the church had stopped
 * claiming.
 *
 * Equal area rather than a centroid cross: the territory is a wedge, and a
 * centroid split gave one quadrant a third of the ground and another nine
 * percent with no neighbourhood in it.
 */

/** Sutherland–Hodgman clip against a half-plane. */
function clip(poly: LatLng[], keep: (p: LatLng) => boolean): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i - 1 + poly.length) % poly.length];
    const cin = keep(cur);
    const pin = keep(prev);
    if (cin) {
      if (!pin) out.push(cut(prev, cur, keep));
      out.push(cur);
    } else if (pin) {
      out.push(cut(prev, cur, keep));
    }
  }
  return out;
}

/** Where the edge a→b crosses the boundary, by bisection. */
function cut(a: LatLng, b: LatLng, keep: (p: LatLng) => boolean): LatLng {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const p = { lat: a.lat + (b.lat - a.lat) * mid, lng: a.lng + (b.lng - a.lng) * mid };
    if (keep(p) === keep(a)) lo = mid;
    else hi = mid;
  }
  const t = (lo + hi) / 2;
  return {
    lat: +(a.lat + (b.lat - a.lat) * t).toFixed(6),
    lng: +(a.lng + (b.lng - a.lng) * t).toFixed(6),
  };
}

/** Shoelace, with longitude scaled by cos(lat) so this is ground area. */
function area(poly: LatLng[]): number {
  if (poly.length < 3) return 0;
  const pts = poly.map((p) => [p.lng * Math.cos((p.lat * Math.PI) / 180), p.lat]);
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    s += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return Math.abs(s) / 2;
}

/** The value on `axis` that leaves half the area on the low side. */
function halve(poly: LatLng[], axis: "lat" | "lng"): number {
  const vals = poly.map((p) => p[axis]);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const total = area(poly);
  if (total === 0) return (lo + hi) / 2;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const low = clip(poly, (p) => p[axis] <= mid);
    if (area(low) / total < 0.5) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export type Quadrants = {
  north_west: LatLng[];
  north_east: LatLng[];
  south_west: LatLng[];
  south_east: LatLng[];
};

export function splitIntoQuadrants(territory: LatLng[]): Quadrants {
  const lngCut = halve(territory, "lng");
  const west = clip(territory, (p) => p.lng <= lngCut);
  const east = clip(territory, (p) => p.lng >= lngCut);
  const westCut = halve(west, "lat");
  const eastCut = halve(east, "lat");
  return {
    north_west: clip(west, (p) => p.lat >= westCut),
    south_west: clip(west, (p) => p.lat <= westCut),
    north_east: clip(east, (p) => p.lat >= eastCut),
    south_east: clip(east, (p) => p.lat <= eastCut),
  };
}
