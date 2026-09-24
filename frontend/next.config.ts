import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: process.env.VERCEL
    ? undefined
    : "standalone",
};

export default nextConfig;