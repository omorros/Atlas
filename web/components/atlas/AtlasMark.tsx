"use client";

import { motion } from "framer-motion";

const LETTERS = ["A", "t", "l", "a", "s"];

export default function AtlasMark({
  size = "huge",
  italic = true,
}: {
  size?: "huge" | "small";
  italic?: boolean;
}) {
  const cls =
    size === "huge"
      ? "text-[18vw] md:text-[14vw] leading-[0.85]"
      : "text-2xl md:text-3xl leading-none";

  return (
    <h1
      aria-label="Atlas"
      className={`font-display ${italic ? "italic" : ""} ${cls} text-paper tracking-tightest select-none`}
    >
      {LETTERS.map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ y: "100%", opacity: 0, rotateX: -40 }}
          animate={{ y: "0%", opacity: 1, rotateX: 0 }}
          transition={{
            delay: 0.15 + i * 0.07,
            duration: 0.9,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            transformOrigin: "50% 100%",
            display: "inline-block",
            textShadow: size === "huge" ? "0 1px 0 rgba(0,0,0,0.3), 0 0 80px rgba(201,168,110,0.18)" : undefined,
          }}
        >
          {ch}
        </motion.span>
      ))}
    </h1>
  );
}
