"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
// Same-origin worker URL (bundled). Cross-origin CDN workerUrl throws SecurityError from localhost.
import mapboxWorkerUrl from "mapbox-gl/dist/mapbox-gl-csp-worker.js?url";
import type { Counterparty } from "@/lib/types";

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
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
    if (!token) {
      setError("NEXT_PUBLIC_MAPBOX_TOKEN missing in web/.env");
      return;
    }
    mapboxgl.workerUrl = mapboxWorkerUrl;
    mapboxgl.accessToken = token;
    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: ref.current,
        style: "mapbox://styles/mapbox/dark-v11",
        projection: { name: "globe" },
        center: [0, 30],
        zoom: 1.4,
        attributionControl: false,
      });
    } catch (e: any) {
      console.error("[mapbox] construction failed", e);
      setError(`Mapbox failed to initialize: ${e?.message ?? e}`);
      return;
    }
    map.on("error", (e) => {
      const errObj = (e as any)?.error || e;
      const status = errObj?.status ?? (errObj as any)?.statusCode;
      const msg = errObj?.message || errObj?.toString?.() || "unknown error";
      console.error("[mapbox]", { status, msg, raw: e });
      if (status === 401 || /401|unauthor|invalid.*token/i.test(msg)) {
        setError("Mapbox token rejected (401). Re-copy a fresh token from account.mapbox.com — the current one is invalid or truncated.");
      } else if (status === 403) {
        setError("Mapbox token forbidden (403). Token exists but lacks access to this style.");
      } else {
        setError(msg);
      }
    });
    // Safety: if style never loads in 6s, surface the issue
    const loadTimeout = setTimeout(() => {
      if (!styleLoadedRef.current) {
        setError("Mapbox style took too long to load. Check your network or token scope.");
      }
    }, 6000);

    map.on("style.load", () => {
      styleLoadedRef.current = true;
      clearTimeout(loadTimeout);
      map.setFog({
        color: "rgb(28, 36, 48)",
        "high-color": "rgb(60, 80, 105)",
        "horizon-blend": 0.15,
        "space-color": "rgb(2, 4, 8)",
        "star-intensity": 0.7,
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
    map.once("load", () => {
      map.resize();
      requestAnimationFrame(() => map.resize());
    });
    mapRef.current = map;
    return () => {
      clearTimeout(loadTimeout);
      map.remove();
      mapRef.current = null;
      styleLoadedRef.current = false;
    };
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
    <>
      <div ref={ref} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, background: "#020408" }} />
      {error && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center px-6 pointer-events-none">
          <div className="relative pointer-events-auto max-w-lg w-full px-7 py-6 bg-panel/95 border border-crit/40 rounded-sm shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
            <span aria-hidden className="absolute top-2 left-2 w-2 h-2 border-l border-t border-crit/70" />
            <span aria-hidden className="absolute top-2 right-2 w-2 h-2 border-r border-t border-crit/70" />
            <span aria-hidden className="absolute bottom-2 left-2 w-2 h-2 border-l border-b border-crit/70" />
            <span aria-hidden className="absolute bottom-2 right-2 w-2 h-2 border-r border-b border-crit/70" />
            <div className="font-mono text-[10px] tracking-[0.3em] text-crit uppercase mb-2">
              Globe offline
            </div>
            <div className="font-display italic text-2xl text-paper leading-snug mb-3">
              Couldn't load Mapbox.
            </div>
            <div className="text-sm text-paper-dim leading-relaxed">{error}</div>
            <a
              href="https://account.mapbox.com/access-tokens/"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.25em] uppercase text-accent hover:text-paper transition"
            >
              Open Mapbox tokens →
            </a>
          </div>
        </div>
      )}
    </>
  );
}
