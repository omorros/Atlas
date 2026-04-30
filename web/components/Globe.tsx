"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { Counterparty } from "@/lib/types";

const COLOURS: Record<string, string> = {
  stable: "#22c55e",
  watch: "#f59e0b",
  fragile: "#ef4444",
};

export default function Globe({ counterparties }: { counterparties: Counterparty[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.warn("NEXT_PUBLIC_MAPBOX_TOKEN missing - globe will not render. Get a free token at mapbox.com");
      return;
    }
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/dark-v11",
      projection: { name: "globe" },
      center: [0, 30],
      zoom: 1.4,
    });
    map.on("style.load", () => {
      map.setFog({
        color: "rgb(20, 24, 30)",
        "high-color": "rgb(40, 50, 60)",
        "horizon-blend": 0.1,
        "space-color": "rgb(8, 10, 14)",
        "star-intensity": 0.6,
      });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Render counterparty markers. TODO(C): replace with circle layer + GeoJSON source for perf + animations.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers: mapboxgl.Marker[] = [];
    const add = () => {
      counterparties.forEach((cp) => {
        const el = document.createElement("div");
        el.style.width = cp.type === "bank" ? "16px" : "12px";
        el.style.height = el.style.width;
        el.style.borderRadius = "50%";
        el.style.background = COLOURS[cp.health_tag] || COLOURS.stable;
        el.style.boxShadow = `0 0 12px ${COLOURS[cp.health_tag] || COLOURS.stable}`;
        el.style.border = "2px solid #0a0d12";
        el.title = `${cp.name} · ${cp.type} · ${cp.health_tag}`;
        const m = new mapboxgl.Marker(el).setLngLat([cp.lng, cp.lat]).addTo(map);
        markers.push(m);
      });
    };
    if (map.isStyleLoaded()) add(); else map.once("load", add);
    return () => markers.forEach((m) => m.remove());
  }, [counterparties]);

  return (
    <div ref={ref} className="absolute inset-0">
      {!process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
          Add NEXT_PUBLIC_MAPBOX_TOKEN to web/.env to render the globe.
        </div>
      )}
    </div>
  );
}
