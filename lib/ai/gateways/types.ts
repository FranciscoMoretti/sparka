import type { ImageModel, LanguageModel } from "ai";
import type { AiGatewayModel } from "../ai-gateway-models-schemas";

export type GatewayType = "vercel" | "openrouter";

export type GatewayProvider = {
  readonly type: GatewayType;

  /** Create a language model instance from a model ID like "openai/gpt-5-nano" */
  createLanguageModel(modelId: string): LanguageModel;

  /** Create a dedicated image model instance, or null if unsupported */
  createImageModel(modelId: string): ImageModel | null;

  /** Fetch the list of available models from the gateway's API */
  fetchModels(): Promise<AiGatewayModel[]>;

  /** Return the API key for this gateway, if configured */
  getApiKey(): string | undefined;

  /** Return the URL for the models list endpoint */
  getModelsUrl(): string;
};
