import type chatConfig from "@/chat.config";
import type {
  DefaultGateway,
  GatewayImageModelIdMap,
  GatewayModelIdMap,
  GatewayType,
} from "./gateways/registry";

/** The gateway type actively selected in chat.config.ts */
export type ActiveGatewayType = typeof chatConfig extends {
  ai: { gateway: infer G extends GatewayType };
}
  ? G
  : DefaultGateway;

/** Runtime model ID — narrowed to the active gateway */
export type ModelId = GatewayModelIdMap[ActiveGatewayType];

/** App-level model ID (same as ModelId; autocomplete comes from ConfigInput) */
export type AppModelId = ModelId;

export type ImageModelId = GatewayImageModelIdMap[ActiveGatewayType];
