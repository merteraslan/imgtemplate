/** @type {import('next').NextConfig} */

const nextConfig = {
  output: "standalone", // Optimizes the output for Vercel
  experimental: {},
  // External packages that should be bundle with the server code
  serverExternalPackages: ["@sparticuz/chromium"],
  // Increase function execution timeout for image generation
  serverRuntimeConfig: {
    functionTimeout: 60, // 60 seconds timeout
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark chromium as external to be properly included in the standalone output
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "@sparticuz/chromium",
      ];
    }
    return config;
  },
};

module.exports = nextConfig;
