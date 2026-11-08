import type { NextConfig } from "next";

// Free GitHub Pages project URL: https://makaiopluto-maker.github.io/stella-now/
// Capacitor / local builds omit GITHUB_PAGES and stay at the origin root.
const basePath = process.env.GITHUB_PAGES === "1" ? "/stella-now" : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: { unoptimized: true },
  devIndicators: false,
  ...(process.env.NODE_ENV === "production"
    ? {}
    : {
        skipTrailingSlashRedirect: true,
        async rewrites() {
          return [
            {
              source: "/chzzk-live/:channelId",
              destination:
                "https://api.chzzk.naver.com/polling/v2/channels/:channelId/live-status",
            },
            {
              source: "/cafe-notices",
              destination: "https://apis.naver.com/cafe-web/cafe2/ArticleListV2dot1.json",
            },
            {
              source: "/fanding-posts",
              destination: "https://fanding.kr/rest/post_list",
            },
          ];
        },
      }),
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
