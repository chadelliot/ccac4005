/// <reference types="google.maps" />
import { useEffect, useRef } from "react";
import { MarkerClusterer } from "@googlemaps/markerclusterer";

export type MapContact = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  where_met: string | null;
  created_at: string;
};

declare global {
  interface Window {
    google?: typeof google;
    __ccacInitMap?: () => void;
    __ccacMapReady?: Promise<void>;
  }
}

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__ccacMapReady) return window.__ccacMapReady;

  window.__ccacMapReady = new Promise<void>((resolve, reject) => {
    if (!BROWSER_KEY) {
      reject(new Error("Google Maps browser key missing"));
      return;
    }
    window.__ccacInitMap = () => resolve();
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: BROWSER_KEY,
      loading: "async",
      callback: "__ccacInitMap",
      libraries: "marker",
    });
    if (TRACKING_ID) params.set("channel", TRACKING_ID);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return window.__ccacMapReady;
}

export function EvangelismMap({
  contacts,
  onMarkerClick,
}: {
  contacts: MapContact[];
  onMarkerClick?: (contact: MapContact) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;
        if (!mapRef.current) {
          mapRef.current = new window.google.maps.Map(ref.current, {
            center: { lat: 39.2904, lng: -76.6122 }, // Baltimore default
            zoom: 4,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            styles: [
              { featureType: "poi", stylers: [{ visibility: "off" }] },
              { featureType: "transit", stylers: [{ visibility: "off" }] },
            ],
          });
        }
        renderMarkers();
      })
      .catch((e) => console.error("[EvangelismMap]", e));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current) renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts]);

  const renderMarkers = () => {
    if (!mapRef.current || !window.google) return;
    clustererRef.current?.clearMarkers();

    const info = new window.google.maps.InfoWindow();
    const markers: google.maps.Marker[] = contacts.map((c) => {
      const marker = new window.google!.maps.Marker({
        position: { lat: c.latitude, lng: c.longitude },
        title: c.name,
      });
      marker.addListener("click", () => {
        info.setContent(
          `<div style="font-family:system-ui;max-width:220px;padding:4px 2px;">
             <div style="font-weight:600;margin-bottom:2px;">${escapeHtml(c.name)}</div>
             ${c.where_met ? `<div style="font-size:12px;color:#555;">${escapeHtml(c.where_met)}</div>` : ""}
             <div style="font-size:11px;color:#777;margin-top:4px;">Added ${new Date(c.created_at).toLocaleDateString()}</div>
           </div>`,
        );
        info.open({ anchor: marker, map: mapRef.current! });
        onMarkerClick?.(c);
      });
      return marker;
    });

    clustererRef.current = new MarkerClusterer({ map: mapRef.current, markers });

    // Fit bounds
    if (markers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend(m.getPosition()!));
      mapRef.current.fitBounds(bounds, 60);
      if (markers.length === 1) {
        mapRef.current.setZoom(13);
      }
    }
  };

  if (!BROWSER_KEY) {
    return (
      <div className="border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Google Maps key not configured.
      </div>
    );
  }

  return <div ref={ref} className="w-full h-[480px] rounded-sm border border-border" />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
