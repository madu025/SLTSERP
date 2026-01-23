import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts']
  },
  // Build Performance Optimizations
  typescript: {
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: false,
} as any;

export default nextConfig;
