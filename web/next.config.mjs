import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Next only auto-loads `.env*` from `web/`. Many contributors put shared
 * `NEXT_PUBLIC_*` keys in the repo root `.env` — merge those in before the
 * client bundle is compiled (so Mapbox and API URLs resolve).
 */
function mergeRootEnv() {
  const rootEnvPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(rootEnvPath)) return;
  const lines = fs.readFileSync(rootEnvPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[\w.-]+$/.test(key)) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

mergeRootEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // mapbox-gl doesn't survive strict-mode double-mount in dev
  transpilePackages: ["mapbox-gl"],
};
export default nextConfig;
