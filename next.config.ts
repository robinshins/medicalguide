import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Rewrite /sitemap.xml to API route (avoids [lang] catching it)
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/sitemap.xml', destination: '/api/sitemap' },
      ],
    };
  },
  // Allow Naver image domains
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.naver.com' },
      { protocol: 'https', hostname: '**.pstatic.net' },
      { protocol: 'https', hostname: '**.kakaocdn.net' },
    ],
  },
  // Ignore build errors for initial deployment
  typescript: {
    ignoreBuildErrors: false,
  },
  // Server external packages for puppeteer
  serverExternalPackages: [
    'puppeteer-core',
    '@sparticuz/chromium',
    'firebase-admin',
    '@anthropic-ai/sdk',
    'openai',
  ],
};

export default nextConfig;
