"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { Counterparty } from "@/lib/types";

const COLOURS: Record<string, string> = {
  stable: "#86a99a",
  watch: "#d8a85b",
  fragile: "#d97757",
};

const esc = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatFundingAmount = (musd: number): string => {
  if (musd >= 1000) {
    const b = musd / 1000;
    return Number.isInteger(b) ? `$${b}B` : `$${b.toFixed(1)}B`;
  }
  return Number.isInteger(musd) ? `$${musd}M` : `$${musd.toFixed(1)}M`;
};

const formatFundingDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

const formatIncorporated = (s: string): string => {
  const m = s.match(/^(\d{4})/);
  return m ? m[1] : s;
};

function buildSpecterPopupHTML(cp: Counterparty, pinned: boolean): string {
  const chip = COLOURS[cp.health_tag] || COLOURS.stable;
  const closeBtn = pinned
    ? `<button data-cp-popup-close="1" aria-label="Close" style="position:absolute;top:6px;right:8px;width:20px;height:20px;background:transparent;border:0;color:#b8ad94;font-size:18px;line-height:1;cursor:pointer;padding:0;font-family:inherit;">×</button>`
    : "";

  const subline = `${esc(cp.type)} · ${esc(cp.region)} · ${esc(cp.provider)}`;
  const header = `
    <div style="padding:10px 12px;position:relative;${pinned ? "padding-right:32px;" : ""}">
      ${closeBtn}
      <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;">
        <div style="font-weight:600;color:#ece2c9;font-size:13px;letter-spacing:0.01em;">${esc(cp.name)}</div>
        <span style="font-size:9px;letter-spacing:0.18em;text-transform:uppercase;padding:2px 6px;border-radius:3px;background:${chip}26;color:${chip};border:1px solid ${chip}55;font-family:ui-monospace,Menlo,monospace;flex-shrink:0;">${esc(cp.health_tag)}</span>
      </div>
      <div style="margin-top:3px;color:#b8ad94;font-size:10px;font-family:ui-monospace,Menlo,monospace;letter-spacing:0.04em;">${subline}</div>
    </div>`;

  const profile = cp.profile_json;
  if (!profile) {
    return `<div style="background:#0f141b;border:1px solid #23303d;border-radius:6px;color:#ece2c9;width:260px;font-family:ui-sans-serif,system-ui,sans-serif;overflow:hidden;box-shadow:0 12px 32px -12px rgba(0,0,0,0.65);">
      ${header}
      <div style="padding:8px 12px;border-top:1px solid #23303d;color:#5a6677;font-size:11px;font-style:italic;font-family:ui-monospace,Menlo,monospace;">No Specter profile</div>
    </div>`;
  }

  const deltaPct = Math.round(profile.headcount_delta_90d_pct);
  const deltaPositive = deltaPct >= 0;
  const arrow = deltaPositive ? "▲" : "▼";
  const arrowColor = deltaPositive ? "#86a99a" : "#d97757";
  const sign = deltaPositive ? "+" : "";

  const rowStyle =
    "display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:3px 0;font-family:ui-monospace,Menlo,monospace;font-size:11px;";

  let factRows = `
    <div style="${rowStyle}">
      <span style="color:#b8ad94;">Headcount</span>
      <span style="color:#ece2c9;text-align:right;">${profile.headcount.toLocaleString("en-US")}<span style="color:${arrowColor};margin-left:8px;">${arrow} ${sign}${deltaPct}% (90d)</span></span>
    </div>`;

  if (profile.last_funding_round_amount_musd != null || profile.last_funding_round_date) {
    const amount =
      profile.last_funding_round_amount_musd != null
        ? formatFundingAmount(profile.last_funding_round_amount_musd)
        : null;
    const date = profile.last_funding_round_date
      ? formatFundingDate(profile.last_funding_round_date)
      : null;
    const value = [amount, date].filter(Boolean).join(" · ");
    factRows += `
      <div style="${rowStyle}">
        <span style="color:#b8ad94;">Last funding</span>
        <span style="color:#ece2c9;text-align:right;">${esc(value)}</span>
      </div>`;
  }

  factRows += `
    <div style="${rowStyle}">
      <span style="color:#b8ad94;">Incorporated</span>
      <span style="color:#ece2c9;text-align:right;">${esc(formatIncorporated(profile.incorporated))}</span>
    </div>`;

  const factsSection = `<div style="padding:8px 12px;border-top:1px solid #23303d;">${factRows}</div>`;

  let investorsSection = "";
  if (profile.investors.length > 0) {
    const shown = profile.investors.slice(0, 4).map(esc).join(' <span style="color:#5a6677;">·</span> ');
    const more = profile.investors.length - 4;
    const moreEl = more > 0 ? ` <span style="color:#5a6677;">+${more} more</span>` : "";
    investorsSection = `
      <div style="padding:8px 12px;border-top:1px solid #23303d;">
        <div style="font-family:ui-monospace,Menlo,monospace;font-size:9px;letter-spacing:0.22em;color:#b8ad94;text-transform:uppercase;margin-bottom:5px;">Investors</div>
        <div style="color:#ece2c9;font-size:11px;line-height:1.5;">${shown}${moreEl}</div>
      </div>`;
  }

  let newsSection = "";
  if (profile.news_flags.length > 0) {
    const chips = profile.news_flags
      .map(
        (f) =>
          `<div style="display:inline-block;padding:2px 7px;margin:3px 4px 0 0;background:#d9775714;border:1px solid #d9775744;color:#d97757;font-size:11px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;">${esc(f)}</div>`,
      )
      .join("");
    newsSection = `
      <div style="padding:8px 12px;border-top:1px solid #23303d;">
        <div style="font-family:ui-monospace,Menlo,monospace;font-size:9px;letter-spacing:0.22em;color:#d97757;text-transform:uppercase;margin-bottom:2px;">⚠ News flags</div>
        <div>${chips}</div>
      </div>`;
  }

  let footerSection = "";
  if (profile.website || profile.address) {
    const parts: string[] = [];
    if (profile.website && /^https?:\/\//i.test(profile.website)) {
      const cleaned = profile.website.replace(/^https?:\/\//i, "").replace(/\/$/, "");
      parts.push(
        `<a href="${esc(profile.website)}" target="_blank" rel="noreferrer" style="color:#c9a86e;text-decoration:none;">${esc(cleaned)}</a>`,
      );
    }
    if (profile.address) parts.push(`<span style="color:#b8ad94;">${esc(profile.address)}</span>`);
    if (parts.length > 0) {
      footerSection = `
        <div style="padding:8px 12px;border-top:1px solid #23303d;font-family:ui-monospace,Menlo,monospace;font-size:10px;line-height:1.5;">
          ${parts.join('<span style="color:#5a6677;margin:0 7px;">·</span>')}
        </div>`;
    }
  }

  return `<div style="background:#0f141b;border:1px solid #23303d;border-radius:6px;color:#ece2c9;width:300px;font-family:ui-sans-serif,system-ui,sans-serif;overflow:hidden;box-shadow:0 12px 32px -12px rgba(0,0,0,0.65);">
    ${header}
    ${factsSection}
    ${investorsSection}
    ${newsSection}
    ${footerSection}
  </div>`;
}

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
  const counterpartiesRef = useRef<Counterparty[]>(counterparties);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    counterpartiesRef.current = counterparties;
  }, [counterparties]);

  // Init map
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
    if (!token) {
      setError("NEXT_PUBLIC_MAPBOX_TOKEN missing in web/.env");
      return;
    }
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

      // Specter info popup — hover to peek, click to pin.
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "radar-popup",
        maxWidth: "320px",
        offset: 14,
      });
      let pinnedId: string | null = null;

      const findCp = (id: string) =>
        counterpartiesRef.current.find((c) => c.id === id) ?? null;

      const showPopup = (
        cp: Counterparty,
        lngLat: [number, number],
        pinned: boolean,
      ) => {
        popup.setLngLat(lngLat).setHTML(buildSpecterPopupHTML(cp, pinned)).addTo(map);
      };

      // Re-attach the × delegated listener every time the popup re-mounts
      // (mapbox rebuilds the DOM on each addTo).
      popup.on("open", () => {
        const el = popup.getElement();
        if (!el) return;
        el.addEventListener("click", (ev) => {
          const t = ev.target as HTMLElement | null;
          if (t?.closest('[data-cp-popup-close="1"]')) {
            pinnedId = null;
            popup.remove();
          }
        });
      });

      map.on("mouseenter", "cp-dot", (e) => {
        map.getCanvas().style.cursor = "pointer";
        if (pinnedId) return;
        const f = e.features?.[0];
        if (!f) return;
        const id = (f.properties as any).id as string;
        const cp = findCp(id);
        if (!cp) return;
        showPopup(cp, (f.geometry as any).coordinates, false);
      });

      map.on("mouseleave", "cp-dot", () => {
        map.getCanvas().style.cursor = "";
        if (pinnedId) return;
        popup.remove();
      });

      map.on("click", "cp-dot", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = (f.properties as any).id as string;
        if (pinnedId === id) {
          pinnedId = null;
          popup.remove();
          return;
        }
        const cp = findCp(id);
        if (!cp) return;
        pinnedId = id;
        showPopup(cp, (f.geometry as any).coordinates, true);
      });

      // Click on empty map background unpins.
      map.on("click", (e) => {
        if (!pinnedId) return;
        const hits = map.queryRenderedFeatures(e.point, { layers: ["cp-dot"] });
        if (hits.length === 0) {
          pinnedId = null;
          popup.remove();
        }
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
