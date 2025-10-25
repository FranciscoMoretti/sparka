import type { NextConfig } from "next";

const MODEL_REGISTRY_URL = "airegistry.app";

const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: ["@airegistry/vercel-gateway"],
  experimental: {
    optimizePackageImports: [
      "react-tweet",
      "echarts-for-react",
      "@lobehub/icons",
    ],
    // Enable external packages for server components to allow pino transports
  },
  // PPR (Partial Prerendering) configuration moved to cacheComponents in Next.js 16
  cacheComponents: true,
  serverExternalPackages: ["pino", "pino-pretty"],
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
        pathname: "**",
      },
      {
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  redirects: async () => [
    {
      source: "/models",
      destination: `https://${MODEL_REGISTRY_URL}`,
      permanent: true,
    },
    {
      source: "/models/:path*",
      destination: `https://${MODEL_REGISTRY_URL}/models/:path*`,
      permanent: true,
    },
    {
      source: "/compare",
      destination: `https://${MODEL_REGISTRY_URL}/compare`,
      permanent: true,
    },
    {
      source: "/compare/:path*",
      destination: `https://${MODEL_REGISTRY_URL}/compare/:path*`,
      permanent: true,
    },
  ],
};

export default nextConfig;
