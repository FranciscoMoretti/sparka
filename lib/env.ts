import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { siteConfig } from "./config";

export const env = createEnv({
  server: {
    // Required core
    DATABASE_URL: z.string().min(1),
    AUTH_SECRET: z.string().min(1),
    BLOB_READ_WRITE_TOKEN: z.string().min(1),

    // Authentication providers (enable in lib/config.ts)
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
    AUTH_GITHUB_ID: z.string().optional(),
    AUTH_GITHUB_SECRET: z.string().optional(),
    VERCEL_APP_CLIENT_ID: z.string().optional(),
    VERCEL_APP_CLIENT_SECRET: z.string().optional(),

    // One of the AI Gateway API key or Vercel OIDC token must be configured
    AI_GATEWAY_API_KEY: z.string().optional(),
    VERCEL_OIDC_TOKEN: z.string().optional(),

    // Optional cleanup cron job secret
    CRON_SECRET: z.string().optional(),

    // Optional features (enable in lib/config.ts)
    REDIS_URL: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    TAVILY_API_KEY: z.string().optional(),
    EXA_API_KEY: z.string().optional(),
    FIRECRAWL_API_KEY: z.string().optional(),
    MCP_ENCRYPTION_KEY: z.string().length(44).optional(),

    // Sandbox (for non-Vercel deployments)
    VERCEL_TEAM_ID: z.string().optional(),
    VERCEL_PROJECT_ID: z.string().optional(),
    VERCEL_TOKEN: z.string().optional(),
    VERCEL_SANDBOX_RUNTIME: z.string().optional(),

    // Misc / platform
    VERCEL_URL: z.string().optional(),
    VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  },
  client: {},
  experimental__runtimeEnv: {},
});

type ValidationError = { feature: string; missing: string[] };

function isEdgeRuntime(): boolean {
  return (
    typeof process !== "undefined" && process.env?.NEXT_RUNTIME === "edge"
  );
}

/**
 * Validates that enabled features in siteConfig have their required env vars.
 * Call at server startup (instrumentation.ts).
 * Throws in production, warns in development.
 */
export function validateConfig(): void {
  // Next middleware runs in the edge runtime where not all server env vars exist.
  if (isEdgeRuntime()) return;

  const errors: ValidationError[] = [];

  // Validate AI Gateway access (required for live model discovery + providers)
  if (!(env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN)) {
    errors.push({
      feature: "aiGateway",
      missing: ["AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN"],
    });
  }

  // Validate integrations
  if (
    siteConfig.integrations.webSearch &&
    !(env.TAVILY_API_KEY || env.FIRECRAWL_API_KEY)
  ) {
    errors.push({
      feature: "integrations.webSearch",
      missing: ["TAVILY_API_KEY or FIRECRAWL_API_KEY"],
    });
  }

  if (siteConfig.integrations.mcp && !env.MCP_ENCRYPTION_KEY) {
    errors.push({
      feature: "integrations.mcp",
      missing: ["MCP_ENCRYPTION_KEY"],
    });
  }

  // Sandbox requires OIDC (Vercel-hosted) or token auth (self-hosted)
  if (siteConfig.integrations.sandbox) {
    const hasOidc = !!env.VERCEL_OIDC_TOKEN;
    const hasTokenAuth =
      env.VERCEL_TEAM_ID && env.VERCEL_PROJECT_ID && env.VERCEL_TOKEN;

    if (!(hasOidc || hasTokenAuth)) {
      errors.push({
        feature: "integrations.sandbox",
        missing: [
          "VERCEL_OIDC_TOKEN (auto on Vercel) or VERCEL_TEAM_ID + VERCEL_PROJECT_ID + VERCEL_TOKEN",
        ],
      });
    }
  }

  // Validate authentication
  if (
    siteConfig.authentication.google &&
    !(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET)
  ) {
    const missing = [];
    if (!env.AUTH_GOOGLE_ID) missing.push("AUTH_GOOGLE_ID");
    if (!env.AUTH_GOOGLE_SECRET) missing.push("AUTH_GOOGLE_SECRET");
    errors.push({ feature: "authentication.google", missing });
  }

  if (
    siteConfig.authentication.github &&
    !(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET)
  ) {
    const missing = [];
    if (!env.AUTH_GITHUB_ID) missing.push("AUTH_GITHUB_ID");
    if (!env.AUTH_GITHUB_SECRET) missing.push("AUTH_GITHUB_SECRET");
    errors.push({ feature: "authentication.github", missing });
  }

  if (
    siteConfig.authentication.vercel &&
    !(env.VERCEL_APP_CLIENT_ID && env.VERCEL_APP_CLIENT_SECRET)
  ) {
    const missing = [];
    if (!env.VERCEL_APP_CLIENT_ID) missing.push("VERCEL_APP_CLIENT_ID");
    if (!env.VERCEL_APP_CLIENT_SECRET) missing.push("VERCEL_APP_CLIENT_SECRET");
    errors.push({ feature: "authentication.vercel", missing });
  }

  // Check at least one auth provider is enabled and configured
  const hasAuth =
    (siteConfig.authentication.google &&
      env.AUTH_GOOGLE_ID &&
      env.AUTH_GOOGLE_SECRET) ||
    (siteConfig.authentication.github &&
      env.AUTH_GITHUB_ID &&
      env.AUTH_GITHUB_SECRET) ||
    (siteConfig.authentication.vercel &&
      env.VERCEL_APP_CLIENT_ID &&
      env.VERCEL_APP_CLIENT_SECRET);

  if (!hasAuth) {
    errors.push({
      feature: "authentication",
      missing: ["At least one auth provider must be enabled and configured"],
    });
  }

  if (errors.length > 0) {
    const message = errors
      .map((e) => `  - ${e.feature}: ${e.missing.join(", ")}`)
      .join("\n");

    const fullMessage = `Config validation failed:\n${message}\n\nEither set the env vars or disable the feature in lib/config.ts`;

    if (process.env.NODE_ENV === "production") {
      throw new Error(fullMessage);
    }
    console.warn(`⚠️  ${fullMessage}`);
  }
}
