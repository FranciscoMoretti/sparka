import userConfig from "@/chat.config";
import type { ActiveGatewayType } from "./ai/app-model-id";
import { type AiConfig, type Config, configSchema } from "./config-schema";

type ActiveAiConfig = Extract<AiConfig, { gateway: ActiveGatewayType }>;

/** Config with the `ai` field narrowed to the active gateway. */
type ActiveConfig = Omit<Config, "ai"> & { ai: ActiveAiConfig };

/**
 * Parsed configuration with defaults applied.
 * Import this for runtime access to config values.
 *
 * @example
 * import { config } from "@/lib/config";
 * console.log(config.appName);
 */
export const config = configSchema.parse(userConfig) as ActiveConfig;

export type { Config } from "./config-schema";
