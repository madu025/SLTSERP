import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  compiler: {
    removeConsole: false, // Keep logs for debugging background workers in production
  },
  experimental: {
    instrumentationHook: true,
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts']
  },
  // Build Performance Optimizations
  typescript: {
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: false,
} as any;

export default nextConfig;
