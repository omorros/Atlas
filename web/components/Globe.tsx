"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { Counterparty, RiskEvent, Transaction } from "@/lib/types";

const COLOURS: Record<string, string> = {
  stable: "#86a99a",
  watch: "#d8a85b",
  fragile: "#d97757",
};

export default function Globe({
  counterparties,
  pulseEvents,
  flowEvents,
}: {
  counterparties: Counterparty[];
  pulseEvents?: { counterparty_id: string; severity: string; ts: number }[];
  flowEvents?: { from: [number, number]; to: [number, number]; direction: "in" | "out"; ts: number }[];
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const styleLoadedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Init map
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setError("NEXT_PUBLIC_MAPBOX_TOKEN missing in web/.env");
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
    map.on("error", (e) => {
      const msg = (e as any)?.error?.message || (e as any)?.message || "unknown Mapbox error";
      const status = (e as any)?.error?.status;
      console.error("[mapbox]", e);
      if (status === 401 || /401|unauthor/i.test(msg)) {
        setError("Mapbox returned 401 — token invalid or truncated. Re-copy from account.mapbox.com.");
      } else {
        setError(`Mapbox error: ${msg}`);
      }
    });
    map.on("style.load", () => {
      styleLoadedRef.current = true;
      map.setFog({
        color: "rgb(20, 24, 30)",
        "high-color": "rgb(40, 50, 60)",
        "horizon-blend": 0.1,
        "space-color": "rgb(8, 10, 14)",
        "star-intensity": 0.6,
      });

      // Counterparties source + circle layers
      map.addSource("counterparties", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      // Halo (pulse) - underneath
      map.addLayer({
        id: "cp-halo",
        type: "circle",
        source: "counterparties",
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["coalesce", ["get", "pulse"], 0],
            0, 0,
            1, 30,
          ],
          "circle-color": ["coalesce", ["get", "color"], "#7dd3fc"],
          "circle-opacity": [
            "interpolate", ["linear"], ["coalesce", ["get", "pulse"], 0],
            0, 0,
            1, 0.35,
          ],
          "circle-blur": 0.6,
        },
      });
      // Solid dot
      map.addLayer({
        id: "cp-dot",
        type: "circle",
        source: "counterparties",
        paint: {
          "circle-radius": ["case", ["==", ["get", "type"], "bank"], 7, 5],
          "circle-color": ["coalesce", ["get", "color"], "#7dd3fc"],
          "circle-stroke-color": "#0a0d12",
          "circle-stroke-width": 2,
        },
      });

      // Flows source + line layer
      map.addSource("flows", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "flow-line",
        type: "line",
        source: "flows",
        paint: {
          "line-color": ["match", ["get", "direction"], "in", "#22c55e", "#7dd3fc"],
          "line-width": 1.5,
          "line-opacity": ["coalesce", ["get", "opacity"], 0.6],
        },
      });

      // Hover popup
      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, className: "radar-popup" });
      map.on("mouseenter", "cp-dot", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as any;
        popup
          .setLngLat((f.geometry as any).coordinates)
          .setHTML(`<div style="background:#11151c;padding:6px 10px;border:1px solid #1f242c;border-radius:6px;color:#e5e7eb;font-size:12px;font-family:ui-monospace,monospace"><strong>${p.name}</strong><br/><span style="color:#9ca3af">${p.type} · ${p.health_tag}</span></div>`)
          .addTo(map);
      });
      map.on("mouseleave", "cp-dot", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; styleLoadedRef.current = false; };
  }, []);

  // Update counterparties source on change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      const src = map.getSource("counterparties") as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;
      const now = Date.now();
      src.setData({
        type: "FeatureCollection",
        features: counterparties.map((cp) => {
          const recent = pulseEvents?.find((e) => e.counterparty_id === cp.id && now - e.ts < 2500);
          const pulseAge = recent ? (now - recent.ts) / 2500 : 1;
          const pulseValue = recent ? 1 - pulseAge : 0;
          return {
            type: "Feature",
            geometry: { type: "Point", coordinates: [cp.lng, cp.lat] },
            properties: {
              id: cp.id,
              name: cp.name,
              type: cp.type,
              health_tag: cp.health_tag,
              color: COLOURS[cp.health_tag] || COLOURS.stable,
              pulse: pulseValue,
            },
          };
        }),
      });
    };
    if (styleLoadedRef.current) update(); else map.once("style.load", update);
  }, [counterparties, pulseEvents]);

  // Animation loop for pulses + flow opacity decay
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let raf = 0;
    const tick = () => {
      const now = Date.now();
      // Counterparty pulses
      const cpSrc = map.getSource("counterparties") as mapboxgl.GeoJSONSource | undefined;
      if (cpSrc && pulseEvents && pulseEvents.length > 0) {
        cpSrc.setData({
          type: "FeatureCollection",
          features: counterparties.map((cp) => {
            const recent = pulseEvents.find((e) => e.counterparty_id === cp.id && now - e.ts < 2500);
            const pulseAge = recent ? (now - recent.ts) / 2500 : 1;
            const pulseValue = recent ? 1 - pulseAge : 0;
            return {
              type: "Feature",
              geometry: { type: "Point", coordinates: [cp.lng, cp.lat] },
              properties: {
                id: cp.id, name: cp.name, type: cp.type,
                health_tag: cp.health_tag,
                color: COLOURS[cp.health_tag] || COLOURS.stable,
                pulse: pulseValue,
              },
            };
          }),
        });
      }
      // Flows
      const flowSrc = map.getSource("flows") as mapboxgl.GeoJSONSource | undefined;
      if (flowSrc && flowEvents && flowEvents.length > 0) {
        flowSrc.setData({
          type: "FeatureCollection",
          features: flowEvents
            .filter((f) => now - f.ts < 3000)
            .map((f) => ({
              type: "Feature",
              geometry: { type: "LineString", coordinates: [f.from, f.to] },
              properties: { direction: f.direction, opacity: 1 - (now - f.ts) / 3000 },
            })),
        });
      }
      raf = requestAnimationFrame(tick);
    };
    if (styleLoadedRef.current) tick(); else map.once("style.load", () => { tick(); });
    return () => cancelAnimationFrame(raf);
  }, [counterparties, pulseEvents, flowEvents]);

  return (
    <div ref={ref} className="absolute inset-0">
      {error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="max-w-md mx-auto px-6 py-4 bg-panel/95 border border-crit/40 rounded-sm font-mono text-[11px] tracking-widest uppercase text-crit text-center">
            <div className="text-paper-dim mb-2">Globe failed to load</div>
            <div className="normal-case tracking-normal text-sm">{error}</div>
          </div>
        </div>
      )}
    </div>
  );
}
