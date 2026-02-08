import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { ImageModel, LanguageModel } from "ai";
import { createModuleLogger } from "@/lib/logger";
import type { AiGatewayModel } from "../ai-gateway-models-schemas";
import { models as fallbackModels } from "../models.generated";
import type { GatewayProvider } from "./types";

const log = createModuleLogger("ai/gateways/openrouter");

type OpenRouterModelResponse = {
  id: string;
  name: string;
  created: number;
  description: string;
  context_length: number | null;
  architecture: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  } | null;
  top_provider: {
    context_length?: number | null;
    max_completion_tokens: number | null;
  } | null;
  pricing: {
    prompt?: string;
    completion?: string;
    image?: string;
    web_search?: string;
    internal_reasoning?: string;
    input_cache_read?: string;
    input_cache_write?: string;
  } | null;
  supported_parameters?: string[] | null;
};

function deriveTags(model: OpenRouterModelResponse): string[] {
  const inputMods = model.architecture?.input_modalities ?? ["text"];
  const outputMods = model.architecture?.output_modalities ?? ["text"];
  const supportedParams = model.supported_parameters ?? [];

  const tags: string[] = [];
  if (inputMods.includes("image")) {
    tags.push("vision");
  }
  if (inputMods.includes("file")) {
    tags.push("file-input");
  }
  if (outputMods.includes("image")) {
    tags.push("image-generation");
  }
  if (
    supportedParams.includes("reasoning") ||
    supportedParams.includes("include_reasoning")
  ) {
    tags.push("reasoning");
  }
  if (supportedParams.includes("tools")) {
    tags.push("tool-use");
  }
  return tags;
}

function toAiGatewayModel(model: OpenRouterModelResponse): AiGatewayModel {
  const tags = deriveTags(model);
  const outputMods = model.architecture?.output_modalities ?? ["text"];

  let type: "language" | "embedding" | "image" = "language";
  if (!outputMods.includes("text") && outputMods.includes("image")) {
    type = "image";
  }

  const owned_by = model.id.split("/")[0] ?? "unknown";

  return {
    id: model.id,
    object: "model",
    created: model.created ?? 0,
    owned_by,
    name: model.name ?? model.id,
    description: model.description ?? "",
    context_window: model.context_length ?? 0,
    max_tokens: model.top_provider?.max_completion_tokens ?? 0,
    type,
    tags: tags.length > 0 ? (tags as AiGatewayModel["tags"]) : undefined,
    pricing: {
      input: model.pricing?.prompt,
      output: model.pricing?.completion,
      image: model.pricing?.image,
      web_search: model.pricing?.web_search,
      input_cache_read: model.pricing?.input_cache_read,
      input_cache_write: model.pricing?.input_cache_write,
    },
  };
}

export class OpenRouterGateway implements GatewayProvider {
  readonly type = "openrouter" as const;

  private getProvider() {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }
    return createOpenRouter({ apiKey });
  }

  createLanguageModel(modelId: string): LanguageModel {
    const provider = this.getProvider();
    return provider.chat(modelId);
  }

  createImageModel(_modelId: string): ImageModel | null {
    // OpenRouter routes image generation through multimodal language models.
    // Return null to signal callers should use createLanguageModel instead.
    return null;
  }

  getApiKey(): string | undefined {
    return process.env.OPENROUTER_API_KEY;
  }

  getModelsUrl(): string {
    return "https://openrouter.ai/api/v1/models";
  }

  async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      log.warn("No OPENROUTER_API_KEY found, using fallback models");
      return fallbackModels as unknown as AiGatewayModel[];
    }

    const url = this.getModelsUrl();
    log.debug({ url }, "Fetching models from OpenRouter");

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        next: { revalidate: 3600 },
      });

      if (!response.ok) {
        log.error(
          { status: response.status, statusText: response.statusText, url },
          "OpenRouter returned non-OK response"
        );
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const body = await response.json();
      const models = (body.data ?? []) as OpenRouterModelResponse[];
      const result = models.map(toAiGatewayModel);

      log.info(
        { modelCount: result.length },
        "Successfully fetched models from OpenRouter"
      );
      return result;
    } catch (error) {
      log.error(
        { err: error, url },
        "Error fetching models from OpenRouter, falling back to generated models"
      );
      return fallbackModels as unknown as AiGatewayModel[];
    }
  }
}
