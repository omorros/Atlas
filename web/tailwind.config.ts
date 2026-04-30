import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0d12",
        panel: "#11151c",
        border: "#1f242c",
        accent: "#7dd3fc",
        ok: "#22c55e",
        warn: "#f59e0b",
        crit: "#ef4444",
      },
    },
  },
  plugins: [],
};
export default config;
