/// <reference types="google.maps" />
import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "./EvangelismMap";

const BROWSER_KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined;

export type LatLng = { lat: number; lng: number };

export type StopPoint = { lat: number; lng: number; label?: string | null };

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
  stops = [],
  onMapClick,
  onStopClick,
  onTerritoryPointClick,
  height = 460,
}: {
  territory: LatLng[];
  zones: Zone[];
  focusZoneId?: string | null;
  onZoneClick?: (zoneId: string) => void;
  /** This week's stops, drawn as numbered pins. */
  stops?: StopPoint[];
  /** Supplied only in plotting mode: clicking the map drops a stop. */
  onMapClick?: (point: LatLng) => void;
  onStopClick?: (index: number) => void;
  /** Supplied while editing the focus area: clicking a corner removes it. */
  onTerritoryPointClick?: (index: number) => void;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const shapesRef = useRef<google.maps.Polygon[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const routeRef = useRef<google.maps.Polygon | google.maps.Polyline | null>(null);
  const clickRef = useRef<google.maps.MapsEventListener | null>(null);
  const framedRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;

        if (!mapRef.current) {
          // center and zoom are required by the Maps API. Omitting them is what
          // opened the map on the whole world before fitBounds had a chance to
          // run. Seeded from the territory's own centre at street level, so the
          // very first paint is already over Baltimore.
          const seed = territory.length
            ? {
                lat: territory.reduce((n, p) => n + p.lat, 0) / territory.length,
                lng: territory.reduce((n, p) => n + p.lng, 0) / territory.length,
              }
            : { lat: 39.3289, lng: -76.5959 };

          mapRef.current = new window.google.maps.Map(ref.current, {
            center: seed,
            zoom: 13,
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

        // Markers are not React-managed, so clear before drawing anything —
        // both the corner handles and the stop pins live in this array, and
        // stale ones would pile up on every redraw.
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        // Corner handles, shown only while the focus area is being edited. The
        // boundary is otherwise a plain outline — handles on a map nobody is
        // editing are just clutter inviting a misclick.
        if (onTerritoryPointClick) {
          territory.forEach((corner, i) => {
            const handle = new window.google!.maps.Marker({
              position: corner,
              map,
              title: `Corner ${i + 1} — click to remove`,
              zIndex: 6,
              icon: {
                path: window.google!.maps.SymbolPath.CIRCLE,
                scale: 6,
                fillColor: "#1d4ed8",
                fillOpacity: 1,
                strokeColor: "#fff",
                strokeWeight: 2,
              },
            });
            handle.addListener("click", () => onTerritoryPointClick(i));
            markersRef.current.push(handle);
          });
        }

        // Join the stops in the order they were dropped, so a route reads as a
        // route. Two points is a line along a street; three or more encloses
        // the block being covered, which is what makes it a coverage area
        // rather than a scattering of pins.
        routeRef.current?.setMap(null);
        routeRef.current = null;
        if (stops.length >= 2) {
          const path = stops.map((s) => ({ lat: s.lat, lng: s.lng }));
          routeRef.current =
            stops.length >= 3
              ? new window.google!.maps.Polygon({
                  paths: path,
                  strokeColor: "#1d4ed8",
                  strokeOpacity: 0.9,
                  strokeWeight: 3,
                  fillColor: "#1d4ed8",
                  fillOpacity: 0.14,
                  clickable: false,
                  zIndex: 4,
                  map,
                })
              : new window.google!.maps.Polyline({
                  path,
                  strokeColor: "#1d4ed8",
                  strokeOpacity: 0.9,
                  strokeWeight: 3,
                  clickable: false,
                  zIndex: 4,
                  map,
                });
        }

        stops.forEach((stop, i) => {
          const marker = new window.google!.maps.Marker({
            position: { lat: stop.lat, lng: stop.lng },
            map,
            label: { text: String(i + 1), color: "#fff", fontSize: "12px", fontWeight: "600" },
            title: stop.label ?? `Stop ${i + 1}`,
            zIndex: 5,
          });
          if (onStopClick) marker.addListener("click", () => onStopClick(i));
          markersRef.current.push(marker);
          bounds.extend({ lat: stop.lat, lng: stop.lng });
        });

        // Plotting mode. Re-bound each pass so the handler never closes over a
        // stale stops array and drops a pin into the wrong position.
        clickRef.current?.remove();
        clickRef.current = null;
        if (onMapClick) {
          clickRef.current = map.addListener("click", (e: google.maps.MapMouseEvent) => {
            if (e.latLng) onMapClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          });
        }

        // Frame the territory once and then leave the view alone. This used to
        // run on every pass with `stops` in the dependencies, so each pin an
        // admin dropped snapped the map back and fought them while plotting.
        // Re-frames only if the territory itself changes.
        const frameKey = JSON.stringify(territory);
        if (!bounds.isEmpty() && framedRef.current !== frameKey) {
          map.fitBounds(bounds, 24);
          framedRef.current = frameKey;

          // fitBounds on a small area can zoom to rooftop level. Cap it so the
          // surrounding streets stay readable — this is a map for finding your
          // way round a neighbourhood, not inspecting a driveway.
          window.google!.maps.event.addListenerOnce(map, "idle", () => {
            if ((map.getZoom() ?? 0) > 16) map.setZoom(16);
          });
        }
      })
      .catch((e) => console.error("[TerritoryMap]", e));

    return () => {
      cancelled = true;
    };
  }, [territory, zones, focusZoneId, onZoneClick, stops, onMapClick, onStopClick, onTerritoryPointClick]);

  // Detach on unmount so the polygons do not outlive the component and leak.
  useEffect(
    () => () => {
      shapesRef.current.forEach((s) => s.setMap(null));
      shapesRef.current = [];
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      routeRef.current?.setMap(null);
      routeRef.current = null;
      clickRef.current?.remove();
    },
    [],
  );

  if (!BROWSER_KEY) {
    return (
      <div
        style={{ height }}
        className="flex w-full flex-col items-center justify-center gap-1 border border-dashed border-border p-8 text-center"
      >
        <div className="text-sm font-medium">Map unavailable</div>
        <p className="max-w-sm text-xs text-muted-foreground">
          No Google Maps browser key is configured for this build. The territory and this week's
          stops are still listed below.
        </p>
      </div>
    );
  }

  return <div ref={ref} style={{ height }} className="w-full border border-border bg-muted" />;
}
