import type { NextConfig } from "next";

/**
 * Two build modes:
 *  - default: Node server (`next start`), with security headers;
 *  - STATIC_EXPORT=1: static files for GitHub Pages (headers are then the host's job).
 */
const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.BASE_PATH || "";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@mansomirror/design-tokens"],
  // Exposed to the client so media URLs work under the GitHub Pages sub-path.
  env: { NEXT_PUBLIC_BASE_PATH: staticExport ? basePath : "" },
  ...(staticExport
    ? { output: "export", basePath, images: { unoptimized: true }, trailingSlash: true }
    : {
        async headers() {
          return [
            {
              source: "/(.*)",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                { key: "X-Frame-Options", value: "DENY" },
                { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
              ],
            },
          ];
        },
      }),
};

export default config;
