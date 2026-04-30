/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // mapbox-gl doesn't survive strict-mode double-mount in dev
  transpilePackages: ["mapbox-gl"],
};
export default nextConfig;
