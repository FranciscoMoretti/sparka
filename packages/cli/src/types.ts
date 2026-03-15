import type {
  authEnvRequirements,
  gatewayEnvRequirements,
} from "../../../apps/chat/lib/config-requirements";

export type PackageManager = "bun" | "npm" | "pnpm" | "yarn";
export type Gateway = keyof typeof gatewayEnvRequirements;
export type AuthProvider = keyof typeof authEnvRequirements;

export const FEATURE_KEYS = [
  "sandbox",
  "webSearch",
  "urlRetrieval",
  "deepResearch",
  "mcp",
  "imageGeneration",
  "attachments",
  "followupSuggestions",
  "parallelResponses",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
