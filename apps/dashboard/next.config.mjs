import path from "node:path";
import { fileURLToPath } from "node:url";

const dashboardDirectory = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiUrl = (
      process.env.API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://localhost:3001"
    ).replace(/\/$/, "");

    return [
      {
        destination: `${apiUrl}/:path*`,
        source: "/api/:path*"
      },
      {
        destination: `${apiUrl}/media/:path*`,
        source: "/media/:path*"
      }
    ];
  },
  turbopack: {
    root: path.resolve(dashboardDirectory, "../..")
  },
  transpilePackages: ["@fieldos/shared", "@fieldos/ui"]
};

export default nextConfig;
