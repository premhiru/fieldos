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
  transpilePackages: ["@fieldos/shared", "@fieldos/ui"]
};

export default nextConfig;
