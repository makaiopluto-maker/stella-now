import type { NextConfig } from "next";

// Custom domain https://stellanow.kr serves at the site root.
// Keep Capacitor / local builds at root as well (no /stella-now prefix).
const basePath = process.env.SITE_BASE_PATH ?? "";

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
