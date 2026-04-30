"use client";

import { motion } from "framer-motion";

/** A horizontal beam connector between pipeline boxes. */
export default function AnimatedBeam({ delay = 0 }: { delay?: number }) {
  return (
    <div className="relative h-px flex-1 self-center overflow-hidden">
      <div className="absolute inset-0 bg-border/60" />
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{
          delay,
          duration: 2.4,
          repeat: Infinity,
          ease: "linear",
          repeatDelay: 0.6,
        }}
        className="absolute inset-y-0 w-1/3"
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(201, 168, 110, 0.85), transparent)",
        }}
      />
    </div>
  );
}
