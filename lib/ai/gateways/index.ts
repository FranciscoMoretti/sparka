import { OpenRouterGateway } from "./openrouter-gateway";
import type { GatewayProvider, GatewayType } from "./types";
import { VercelGateway } from "./vercel-gateway";

export type { GatewayProvider, GatewayType } from "./types";

const gatewayRegistry: Record<GatewayType, () => GatewayProvider> = {
  vercel: () => new VercelGateway(),
  openrouter: () => new OpenRouterGateway(),
};

let activeGateway: GatewayProvider | null = null;

export function getActiveGateway(): GatewayProvider {
  if (activeGateway) {
    return activeGateway;
  }

  // Lazy require to avoid circular dependency (config -> schema -> models -> gateways -> config)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { config } = require("@/lib/config") as {
    config: { gateway?: GatewayType };
  };
  const gatewayType: GatewayType = config.gateway ?? "vercel";

  const factory = gatewayRegistry[gatewayType];
  if (!factory) {
    throw new Error(
      `Unknown gateway type: ${gatewayType}. Supported: ${Object.keys(gatewayRegistry).join(", ")}`
    );
  }

  activeGateway = factory();
  return activeGateway;
}
