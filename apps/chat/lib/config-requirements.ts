import type { GatewayType } from "./ai/gateways/registry";
import type { AiConfig, AuthenticationConfig, FeaturesConfig } from "./config-schema";

type EnvVarName = keyof NodeJS.ProcessEnv;

export type EnvRequirement = {
  options: EnvVarName[][];
  description: string;
};

export const gatewayEnvRequirements: Record<GatewayType, EnvRequirement> = {
  openrouter: {
    options: [["OPENROUTER_API_KEY"]],
    description: "OPENROUTER_API_KEY",
  },
  openai: {
    options: [["OPENAI_API_KEY"]],
    description: "OPENAI_API_KEY",
  },
  vercel: {
    options: [["AI_GATEWAY_API_KEY"], ["VERCEL_OIDC_TOKEN"]],
    description: "AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN",
  },
  "openai-compatible": {
    options: [["OPENAI_COMPATIBLE_BASE_URL", "OPENAI_COMPATIBLE_API_KEY"]],
    description: "OPENAI_COMPATIBLE_BASE_URL, OPENAI_COMPATIBLE_API_KEY",
  },
};

export const featureEnvRequirements: Partial<
  Record<keyof FeaturesConfig, EnvRequirement>
> = {
  attachments: {
    options: [["BLOB_READ_WRITE_TOKEN"]],
    description: "BLOB_READ_WRITE_TOKEN",
  },
};

export const aiToolEnvRequirements: Partial<
  Record<keyof AiConfig["tools"], EnvRequirement>
> = {
  webSearch: {
    options: [["TAVILY_API_KEY"], ["FIRECRAWL_API_KEY"]],
    description: "TAVILY_API_KEY or FIRECRAWL_API_KEY",
  },
  deepResearch: {
    options: [["TAVILY_API_KEY"], ["FIRECRAWL_API_KEY"]],
    description: "TAVILY_API_KEY or FIRECRAWL_API_KEY",
  },
  urlRetrieval: {
    options: [["FIRECRAWL_API_KEY"]],
    description: "FIRECRAWL_API_KEY",
  },
  mcp: {
    options: [["MCP_ENCRYPTION_KEY"]],
    description: "MCP_ENCRYPTION_KEY",
  },
  codeExecution: {
    options: [
      ["VERCEL_OIDC_TOKEN"],
      ["VERCEL_TEAM_ID", "VERCEL_PROJECT_ID", "VERCEL_TOKEN"],
    ],
    description:
      "VERCEL_OIDC_TOKEN (auto on Vercel) or VERCEL_TEAM_ID + VERCEL_PROJECT_ID + VERCEL_TOKEN",
  },
  image: {
    options: [["BLOB_READ_WRITE_TOKEN"]],
    description: "BLOB_READ_WRITE_TOKEN",
  },
};

export const authEnvRequirements: Record<
  keyof AuthenticationConfig,
  EnvRequirement
> = {
  google: {
    options: [["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"]],
    description: "AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET",
  },
  github: {
    options: [["AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"]],
    description: "AUTH_GITHUB_ID, AUTH_GITHUB_SECRET",
  },
  vercel: {
    options: [["VERCEL_APP_CLIENT_ID", "VERCEL_APP_CLIENT_SECRET"]],
    description: "VERCEL_APP_CLIENT_ID, VERCEL_APP_CLIENT_SECRET",
  },
};

export function isRequirementSatisfied(
  requirement: EnvRequirement,
  env: NodeJS.ProcessEnv
): boolean {
  return requirement.options.some((option) =>
    option.every((name) => !!env[name])
  );
}

export function getMissingRequirement(
  requirement: EnvRequirement,
  env: NodeJS.ProcessEnv
): string | null {
  return isRequirementSatisfied(requirement, env)
    ? null
    : requirement.description;
}
