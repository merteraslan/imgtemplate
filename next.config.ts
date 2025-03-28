/** @type {import('next').NextConfig} */

const nextConfig = {
  output: 'standalone', // Optimizes the output for Vercel
  experimental: {
    serverComponentsExternalPackages: ['playwright-core', 'playwright'],
  },
  // Increase function execution timeout for image generation
  serverRuntimeConfig: {
    functionTimeout: 60, // 60 seconds timeout
  }
};

module.exports = nextConfig;
