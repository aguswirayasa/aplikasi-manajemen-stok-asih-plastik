import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.29"],
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;
