import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Centralized environment parsing and feature flags using t3-oss/t3-env

export const env = createEnv({
  server: {
    // Required core
    DATABASE_URL: z.string().min(1),
    AUTH_SECRET: z.string().min(1),
    BLOB_READ_WRITE_TOKEN: z.string().min(1),

    // One of the authentication providers must be configured
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
    AUTH_GITHUB_ID: z.string().optional(),
    AUTH_GITHUB_SECRET: z.string().optional(),

    // One of the AI Gateway API key or Vercel OIDC token must be configured
    AI_GATEWAY_API_KEY: z.string().optional(),
    VERCEL_OIDC_TOKEN: z.string().optional(),

    // Optional cleanup cron job secret
    CRON_SECRET: z.string().optional(),

    // Optional features
    REDIS_URL: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    GOOGLE_GENAI_API_KEY: z.string().optional(),
    TAVILY_API_KEY: z.string().optional(),
    EXA_API_KEY: z.string().optional(),
    FIRECRAWL_API_KEY: z.string().optional(),
    SANDBOX_TEMPLATE_ID: z.string().optional(),

    // Misc / platform
    VERCEL_URL: z.string().optional(),
    VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  },
  client: {},
  experimental__runtimeEnv: {},
});

if (
  typeof window === "undefined" &&
  !(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) &&
  !(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET)
) {
  throw new Error(
    "No social auth providers configured: enable Google by setting AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, or enable GitHub by setting AUTH_GITHUB_ID and AUTH_GITHUB_SECRET."
  );
}

// VERCEL_OIDC_TOKEN is not set on Middleware so this can't be a runtime error
// if (
//   typeof window === "undefined" &&
//   !(env.VERCEL_OIDC_TOKEN || env.AI_GATEWAY_API_KEY)
// ) {
//   throw new Error(
//     "No AI Gateway API key or Vercel OIDC token configured. Please set one of them in the environment variables."
//   );
// }
