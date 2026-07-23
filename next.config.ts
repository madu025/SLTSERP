process.env.TZ = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Colombo';

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : 'standalone',
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  // pdf-parse (v2) bundles pdfjs + worker/native deps that break Next's server
  // webpack bundling. Keep it external so it is required from node_modules at runtime.
  serverExternalPackages: ['pdf-parse'],
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
