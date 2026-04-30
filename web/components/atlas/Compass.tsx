"use client";

import { motion } from "framer-motion";

export default function Compass({ size = 28, slow = true }: { size?: number; slow?: boolean }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      animate={slow ? { rotate: 360 } : undefined}
      transition={slow ? { duration: 60, repeat: Infinity, ease: "linear" } : undefined}
      style={{ display: "inline-block" }}
    >
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
      <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="0.4" opacity="0.3" />
      <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="0.8" />
      <line x1="16" y1="26" x2="16" y2="30" stroke="currentColor" strokeWidth="0.8" />
      <line x1="2" y1="16" x2="6" y2="16" stroke="currentColor" strokeWidth="0.8" />
      <line x1="26" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth="0.8" />
      <polygon points="16,8 19,16 16,24 13,16" fill="currentColor" opacity="0.85" />
      <circle cx="16" cy="16" r="1.4" fill="currentColor" />
    </motion.svg>
  );
}
