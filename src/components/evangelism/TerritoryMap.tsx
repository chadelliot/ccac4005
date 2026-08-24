/// <reference types="google.maps" />
import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "./EvangelismMap";

export type LatLng = { lat: number; lng: number };

export type Zone = {
  id: string;
  name: string;
  description: string | null;
  boundary: LatLng[];
  colour: string;
  coverage?: { contacts: number; visited: number; baptized: number; holy_ghost: number };
};

/**
 * The church's focus area and its four quadrants.
 *
 * Draws boundaries only — no contact pins. That separation is the point: the
 * territory carries no personal information, so every member can see it, while
 * the people recorded inside it stay behind evangelism_management on the
 * leadership map. Showing the shape of the work does not require showing
 * anyone's address.
 *
 * Zone fill is weighted by how little has been covered, so the map answers
 * "where haven't we been" at a glance rather than requiring anyone to read
 * four numbers and compare them.
 */
export function TerritoryMap({
  territory,
  zones,
  focusZoneId,
  onZoneClick,
  height = 460,
}: {
  territory: LatLng[];
  zones: Zone[];
  focusZoneId?: string | null;
  onZoneClick?: (zoneId: string) => void;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const shapesRef = useRef<google.maps.Polygon[]>([]);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;

        if (!mapRef.current) {
          mapRef.current = new window.google.maps.Map(ref.current, {
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            styles: [
              { featureType: "poi", stylers: [{ visibility: "off" }] },
              { featureType: "transit", stylers: [{ visibility: "off" }] },
            ],
          });
        }
        const map = mapRef.current;

        // Clear before redrawing: Google polygons are not React-managed, so
        // leaving them attached stacks a new outline on every render until the
        // borders look several pixels thick.
        shapesRef.current.forEach((s) => s.setMap(null));
        shapesRef.current = [];

        const bounds = new window.google.maps.LatLngBounds();

        if (territory.length > 2) {
          const outline = new window.google.maps.Polygon({
            paths: territory,
            strokeColor: "#2563eb",
            strokeOpacity: 0.95,
            strokeWeight: 3,
            fillOpacity: 0,
            clickable: false,
            map,
          });
          shapesRef.current.push(outline);
          territory.forEach((p) => bounds.extend(p));
        }

        zones.forEach((z) => {
          if (z.boundary.length < 3) return;
          const isFocus = z.id === focusZoneId;
          const contacts = z.coverage?.contacts ?? 0;

          // Heavier fill where less has been done, so untouched ground is the
          // thing that draws the eye. Caps out at ten contacts — past that the
          // difference between 12 and 30 does not change where to go next.
          const worked = Math.min(contacts, 10) / 10;
          const fillOpacity = isFocus ? 0.55 : 0.32 - worked * 0.26;

          const poly = new window.google.maps.Polygon({
            paths: z.boundary,
            strokeColor: z.colour,
            strokeOpacity: isFocus ? 1 : 0.7,
            strokeWeight: isFocus ? 4 : 1.5,
            fillColor: z.colour,
            fillOpacity,
            clickable: Boolean(onZoneClick),
            zIndex: isFocus ? 2 : 1,
            map,
          });
          if (onZoneClick) poly.addListener("click", () => onZoneClick(z.id));
          shapesRef.current.push(poly);
          z.boundary.forEach((p) => bounds.extend(p));
        });

        if (!bounds.isEmpty()) map.fitBounds(bounds, 24);
      })
      .catch((e) => console.error("[TerritoryMap]", e));

    return () => {
      cancelled = true;
    };
  }, [territory, zones, focusZoneId, onZoneClick]);

  // Detach on unmount so the polygons do not outlive the component and leak.
  useEffect(
    () => () => {
      shapesRef.current.forEach((s) => s.setMap(null));
      shapesRef.current = [];
    },
    [],
  );

  return <div ref={ref} style={{ height }} className="w-full border border-border bg-muted" />;
}
