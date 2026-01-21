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
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts'],
    // Enable instrumentation for background workers
    instrumentationHook: true,
    // Deduplicate identical requests within 30 seconds
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  // Build Performance Optimizations
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Disable source maps for production to speed up build
  productionBrowserSourceMaps: false,
} as any;

export default nextConfig;
