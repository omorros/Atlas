"use client";

import { useMemo } from "react";

/**
 * Slow drifting motes. Pure CSS — 24 dots with randomized positions and delays.
 * Cheap and atmospheric. Sits in the background, no interaction.
 */
export default function Particles({ count = 24 }: { count?: number }) {
  const dots = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 1 + Math.random() * 2,
        delay: -Math.random() * 18,
        duration: 14 + Math.random() * 12,
        opacity: 0.15 + Math.random() * 0.4,
      })),
    [count]
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[2] overflow-hidden">
      {dots.map((d) => (
        <span
          key={d.i}
          className="absolute rounded-full bg-paper animate-drift"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: d.size,
            height: d.size,
            opacity: d.opacity,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
