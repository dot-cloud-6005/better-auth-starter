import type { NextConfig } from "next";
// MDX support
import createMDX from '@next/mdx';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  pageExtensions: ["ts","tsx","js","jsx","mdx"],
  eslint: {
    // Run ESLint checks during builds
    ignoreDuringBuilds: false,
  },
  
  // Performance optimizations
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
    ],
    webpackBuildWorker: true,
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Content Security Policy - already handled in middleware, but backup
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      // Specific headers for API routes
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
        ],
      },
    ];
  },
  
  // External packages for server components
  serverExternalPackages: ['sharp'],
  webpack: (config) => {
    // Ensure we don't try to polyfill heavy Node modules; mark as unavailable for browser
    config.resolve = config.resolve || {}
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      path: false,
    }
    return config
  }
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withMDX(nextConfig);
