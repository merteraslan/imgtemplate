/** @type {import('next').NextConfig} */
import path, { dirname } from "path"; // Use import syntax, add dirname
import { fileURLToPath } from "url"; // Add fileURLToPath

// Get the directory name in an ES module context
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
    if (isServer) {
      // Mark chromium as external to be properly included in the standalone output
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "@sparticuz/chromium",
      ];
    }

    // Add rule to inline .woff2 files from src/assets/fonts as Base64 data URLs
    config.module.rules.push({
      test: /\.woff2$/i, // Match .woff2 files (case-insensitive)
      include: [path.resolve(__dirname, "src/assets/fonts")], // Target only our fonts directory
      type: "asset/inline", // Embed as a data URI
    });

    return config;
  },
};

export default nextConfig; // Use ES Module export
