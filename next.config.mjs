/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  allowedDevOrigins: ["169.254.83.107:3000", "http://169.254.83.107:3000"],
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  // Slim Docker image. The `.next/standalone` bundle is a self-contained
  // Node app that can be deployed without the rest of node_modules.
  output: "standalone",
  // In production, the browser only talks to port 3000 (Next.js). This
  // rewrite proxies every `/api/*` request to the Elysia backend on
  // port 4000 internally, so the backend never has to be exposed to
  // the internet. The browser-side `getApiBaseUrl` returns a relative
  // URL to take advantage of this.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4000/api/:path*",
      },
    ];
  },
};

export default config;
