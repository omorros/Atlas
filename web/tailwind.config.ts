import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Atlas palette — deep navy paper meets brass + parchment
        bg: "#080b10",
        panel: "#0f141b",
        ink: "#1a2029",
        border: "#23303d",
        muted: "#5a6677",
        paper: "#ece2c9",
        "paper-dim": "#b8ad94",
        accent: "#c9a86e",        // brass
        "accent-soft": "#8e7a4d",
        ok: "#86a99a",            // sage
        warn: "#d8a85b",
        crit: "#d97757",          // terracotta, not red

        // Legacy aliases (so existing components don't break during transition)
        background: "#080b10",
        foreground: "#ece2c9",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "Menlo", "monospace"],
      },
      letterSpacing: {
        widest: "0.25em",
        tightest: "-0.04em",
      },
      animation: {
        "shimmer-slide": "shimmer-slide 2s ease-in-out infinite alternate",
        "spin-around": "spin-around 3s ease-in-out infinite alternate",
        "blur-fade": "blur-fade 0.8s ease-out both",
        "drift": "drift 18s linear infinite",
        "pulse-soft": "pulse-soft 4s ease-in-out infinite",
        "scan": "scan 6s linear infinite",
      },
      keyframes: {
        "shimmer-slide": {
          to: { transform: "translate(calc(100cqw - 100%), 0)" },
        },
        "spin-around": {
          "0%": { transform: "translateZ(0) rotate(0)" },
          "15%, 35%": { transform: "translateZ(0) rotate(90deg)" },
          "65%, 85%": { transform: "translateZ(0) rotate(270deg)" },
          "100%": { transform: "translateZ(0) rotate(360deg)" },
        },
        "blur-fade": {
          "0%": { opacity: "0", filter: "blur(8px)", transform: "translateY(8px)" },
          "100%": { opacity: "1", filter: "blur(0)", transform: "translateY(0)" },
        },
        "drift": {
          "0%": { transform: "translate(0, 0)" },
          "100%": { transform: "translate(20px, -30px)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        "scan": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(to right, rgba(201,168,110,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(201,168,110,0.05) 1px, transparent 1px)",
        "noise":
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 0.95 0 0 0 0 0.85 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
      backgroundSize: {
        "grid-md": "48px 48px",
        "grid-sm": "24px 24px",
      },
    },
  },
  plugins: [],
};
export default config;
