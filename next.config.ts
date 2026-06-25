// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // ⚠️ Only use this if you're sure your types are correct
    ignoreBuildErrors: true,
  },
};

export default nextConfig;