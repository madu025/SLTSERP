process.env.TZ = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Colombo';

import type { NextConfig } from "next";

// Skip expensive type/lint checks during Docker builds (low-RAM VPS).
// TypeScript is fully checked on Vercel CI before every production deploy.
const isDockerBuild = process.env.DOCKER_BUILD === '1';

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
  typescript: {
    // Skip tsc during Docker builds — prevents OOM on VPS with <4 GB RAM.
    ignoreBuildErrors: isDockerBuild,
  },
  eslint: {
    ignoreDuringBuilds: isDockerBuild,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts']
  },
  async redirects() {
    return [
      {
        source: '/contartor/:path*',
        destination: '/contractor/:path*',
        permanent: true,
      },
    ];
  },
  productionBrowserSourceMaps: false,
};

export default nextConfig;
// Force Next.js dev server to reload schema cache
