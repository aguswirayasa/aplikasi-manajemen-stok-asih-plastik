import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: { incomingRequests: { ignore: [/\/reset-password(?:[/?]|$)/] } },
  async headers() {
    return [{
      source: "/reset-password",
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
    }];
  },
  allowedDevOrigins: ["192.168.1.29"],
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;
