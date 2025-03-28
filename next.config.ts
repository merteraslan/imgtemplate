import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['chrome-aws-lambda'],
  experimental: {
    serverComponentsExternalPackages: ['chrome-aws-lambda', 'puppeteer-core']
  }
};

export default nextConfig;
