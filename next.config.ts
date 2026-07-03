import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.16.28.28", "172.16.71.146"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Vercel 部署配置
  output: 'standalone',
};

export default nextConfig;
