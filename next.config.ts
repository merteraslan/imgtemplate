/** @type {import('next').NextConfig} */
import type { Configuration as WebpackConfig } from 'webpack';

const nextConfig = {
  output: 'standalone', // Optimizes the output for Vercel
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium'],
  },
  // Increase function execution timeout for image generation
  serverRuntimeConfig: {
    functionTimeout: 60, // 60 seconds timeout
  },
  webpack: (config: WebpackConfig, { isServer }: { isServer: boolean }) => {
    if (isServer) {
      // Mark chromium as external to be properly included in the standalone output
      config.externals = [...(config.externals as string[] || []), '@sparticuz/chromium'];
    }
    return config;
  }
};

module.exports = nextConfig;
