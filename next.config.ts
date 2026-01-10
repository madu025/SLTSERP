import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts'],
    // Deduplicate identical requests within 30 seconds
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
