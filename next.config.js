/** @type {import('next').NextConfig} */
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "src"),
    };

    if (isServer) {
      // Mark chromium as external to be properly included in the standalone output
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "@sparticuz/chromium",
      ];
    }

    // Add rule to inline .woff2 files as Base64 data URLs
    config.module.rules.push({
      test: /\.woff2$/i, // Match .woff2 files (case-insensitive)
      type: "asset/inline", // Embed as a data URI
    });

    return config;
  },
};

export default nextConfig; // Use ES Module export
