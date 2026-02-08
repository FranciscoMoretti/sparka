import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import {
  extractReasoningMiddleware,
  type LanguageModelMiddleware,
  wrapLanguageModel,
} from "ai";
import type {
  ImageModelId,
  MultimodalImageModelId,
} from "../models/image-model-id";
import type { AppModelId, ModelId } from "./app-models";
import { getAppModelDefinition } from "./app-models";
import { getActiveGateway } from "./gateways";

const _telemetryConfig = {
  telemetry: {
    isEnabled: true,
    functionId: "get-language-model",
  },
};

export const getLanguageModel = async (modelId: ModelId) => {
  const model = await getAppModelDefinition(modelId);
  const languageProvider = getActiveGateway().createLanguageModel(model.id);

  const middlewares: Parameters<typeof wrapLanguageModel>[0]["middleware"][] =
    [];

  // Add devtools middleware in development
  if (process.env.NODE_ENV === "development") {
    middlewares.push(devToolsMiddleware());
  }

  // Add reasoning middleware if the model supports reasoning
  if (model.reasoning && model.owned_by === "xai") {
    console.log("Wrapping reasoning middleware for", model.id);
    middlewares.push(extractReasoningMiddleware({ tagName: "think" }));
  }

  if (middlewares.length === 0) {
    return languageProvider;
  }

  return wrapLanguageModel({
    model: languageProvider as LanguageModelV3,
    middleware: middlewares as LanguageModelMiddleware[],
  });
};

export const getImageModel = (modelId: ImageModelId) => {
  const imageModel = getActiveGateway().createImageModel(modelId);
  if (!imageModel) {
    throw new Error(
      `Gateway '${getActiveGateway().type}' does not support dedicated image models. Use a multimodal language model instead.`
    );
  }
  return imageModel;
};

// Get a multimodal language model that can generate images via generateText
export const getMultimodalImageModel = (modelId: MultimodalImageModelId) =>
  getActiveGateway().createLanguageModel(modelId);

// Model aliases removed - use getLanguageModel directly with specific model IDs

export const getModelProviderOptions = async (
  providerModelId: AppModelId
): Promise<
  | {
      openai: OpenAIResponsesProviderOptions;
    }
  | {
      anthropic: AnthropicProviderOptions;
    }
  | {
      xai: Record<string, never>;
    }
  | {
      google: GoogleGenerativeAIProviderOptions;
    }
  | Record<string, never>
> => {
  const model = await getAppModelDefinition(providerModelId);
  if (model.owned_by === "openai") {
    if (model.reasoning) {
      return {
        openai: {
          reasoningSummary: "auto",
          ...(model.id === "openai/gpt-5" ||
          model.id === "openai/gpt-5-mini" ||
          model.id === "openai/gpt-5-nano"
            ? { reasoningEffort: "low" }
            : {}),
        } satisfies OpenAIResponsesProviderOptions,
      };
    }
    return { openai: {} };
  }
  if (model.owned_by === "anthropic") {
    if (model.reasoning) {
      return {
        anthropic: {
          thinking: {
            type: "enabled",
            budgetTokens: 4096,
          },
        } satisfies AnthropicProviderOptions,
      };
    }
    return { anthropic: {} };
  }
  if (model.owned_by === "xai") {
    return {
      xai: {},
    };
  }
  if (model.owned_by === "google") {
    if (model.reasoning) {
      return {
        google: {
          thinkingConfig: {
            thinkingBudget: 10_000,
          },
        },
      };
    }
    return { google: {} };
  }
  return {};
};
