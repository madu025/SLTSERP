import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  compiler: {
    removeConsole: false,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts']
  },
  productionBrowserSourceMaps: false,
};

export default nextConfig;
// Force Next.js dev server to reload schema cache
