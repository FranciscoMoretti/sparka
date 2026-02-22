#!/usr/bin/env bun
/**
 * Build-time config validation script.
 * Validates that enabled features in config have their required env vars.
 * Run via `bun run check-env` or automatically in prebuild.
 */
import "dotenv/config";
import type { GatewayType } from "../lib/ai/gateways/registry";
import { generatedForGateway } from "../lib/ai/models.generated";
import { config } from "../lib/config";
import {
  aiToolEnvRequirements,
  authEnvRequirements,
  featureEnvRequirements,
  gatewayEnvRequirements,
  getMissingRequirement,
  isRequirementSatisfied,
} from "../lib/config-requirements";

type ValidationError = { feature: string; missing: string[] };

function validateGatewayKey(env: NodeJS.ProcessEnv): ValidationError | null {
  // Prevent TS from narrowing to the current literal config value.
  const gateway = (() => config.ai.gateway as GatewayType)();
  const requirement = gatewayEnvRequirements[gateway];
  const missing = getMissingRequirement(requirement, env);
  if (!missing) {
    return null;
  }
  return {
    feature: `aiGateway (${gateway})`,
    missing: [missing],
  };
}

function validateFeatures(env: NodeJS.ProcessEnv): ValidationError[] {
  const errors: ValidationError[] = [];

  const gatewayError = validateGatewayKey(env);
  if (gatewayError) {
    errors.push(gatewayError);
  }

  const featureEntries = Object.entries(featureEnvRequirements) as [
    keyof typeof featureEnvRequirements,
    NonNullable<
      (typeof featureEnvRequirements)[keyof typeof featureEnvRequirements]
    >,
  ][];
  for (const [feature, requirement] of featureEntries) {
    if (!(requirement && config.features[feature])) {
      continue;
    }
    const missing = getMissingRequirement(requirement, env);
    if (missing) {
      errors.push({
        feature: `features.${feature}`,
        missing: [missing],
      });
    }
  }

  return errors;
}

function validateAiTools(env: NodeJS.ProcessEnv): ValidationError[] {
  const errors: ValidationError[] = [];

  const toolEntries = Object.entries(aiToolEnvRequirements) as [
    keyof typeof aiToolEnvRequirements,
    NonNullable<
      (typeof aiToolEnvRequirements)[keyof typeof aiToolEnvRequirements]
    >,
  ][];

  for (const [tool, requirement] of toolEntries) {
    const toolConfig = config.ai.tools[tool];
    if (!(requirement && "enabled" in toolConfig && toolConfig.enabled)) {
      continue;
    }
    const missing = getMissingRequirement(requirement, env);
    if (missing) {
      errors.push({
        feature: `ai.tools.${tool}`,
        missing: [missing],
      });
    }
  }

  return errors;
}

function validateAuthentication(env: NodeJS.ProcessEnv): ValidationError[] {
  const errors: ValidationError[] = [];

  const authKeys = Object.keys(authEnvRequirements) as Array<
    keyof typeof authEnvRequirements
  >;
  for (const provider of authKeys) {
    if (!config.authentication[provider]) {
      continue;
    }
    const requirement = authEnvRequirements[provider];
    const missing = getMissingRequirement(requirement, env);
    if (missing) {
      errors.push({
        feature: `authentication.${provider}`,
        missing: [missing],
      });
    }
  }

  const hasAuth = authKeys.some((provider) => {
    if (!config.authentication[provider]) {
      return false;
    }
    return isRequirementSatisfied(authEnvRequirements[provider], env);
  });

  if (!hasAuth) {
    errors.push({
      feature: "authentication",
      missing: ["At least one auth provider must be enabled and configured"],
    });
  }

  return errors;
}

function validateBaseUrl(env: NodeJS.ProcessEnv): ValidationError | null {
  const isProduction = env.NODE_ENV === "production" || env.VERCEL === "1";
  if (!isProduction) {
    return null;
  }

  const hasBaseUrl = !!(env.APP_URL || env.VERCEL_URL);
  if (hasBaseUrl) {
    return null;
  }

  return {
    feature: "baseUrl",
    missing: [
      "APP_URL (for non-Vercel deployments) or VERCEL_URL (auto on Vercel)",
    ],
  };
}

function checkGatewaySnapshot(): string | null {
  if (config.ai.gateway === generatedForGateway) {
    return null;
  }
  return `models.generated.ts was built for "${generatedForGateway}" but config uses "${config.ai.gateway}". Run \`bun fetch:models\` to update the fallback snapshot.`;
}

function checkEnv(): void {
  const env = process.env;
  const baseUrlError = validateBaseUrl(env);
  const errors = [
    ...(baseUrlError ? [baseUrlError] : []),
    ...validateFeatures(env),
    ...validateAiTools(env),
    ...validateAuthentication(env),
  ];

  if (errors.length > 0) {
    const message = errors
      .map((e) => `  - ${e.feature}: ${e.missing.join(", ")}`)
      .join("\n");

    console.error(
      `❌ Environment validation failed:\n${message}\n\nEither set the env vars or disable the feature in chat.config.ts`
    );
    process.exit(1);
  }

  const snapshotWarning = checkGatewaySnapshot();
  if (snapshotWarning) {
    console.warn(`⚠️  ${snapshotWarning}`);
  }

  console.log("✅ Environment validation passed");
}

checkEnv();
