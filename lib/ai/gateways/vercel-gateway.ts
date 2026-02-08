import { gateway } from "@ai-sdk/gateway";
import type { ImageModel, LanguageModel } from "ai";
import { createModuleLogger } from "@/lib/logger";
import {
  type AiGatewayModel,
  aiGatewayModelsResponseSchema,
} from "../ai-gateway-models-schemas";
import { models as fallbackModels } from "../models.generated";
import type { GatewayProvider } from "./types";

const log = createModuleLogger("ai/gateways/vercel");

export class VercelGateway implements GatewayProvider {
  readonly type = "vercel" as const;

  createLanguageModel(modelId: string): LanguageModel {
    return gateway(modelId as Parameters<typeof gateway>[0]);
  }

  createImageModel(modelId: string): ImageModel {
    return gateway.imageModel(
      modelId as Parameters<(typeof gateway)["imageModel"]>[0]
    );
  }

  getApiKey(): string | undefined {
    return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  }

  getModelsUrl(): string {
    return "https://ai-gateway.vercel.sh/v1/models";
  }

  async fetchModels(): Promise<AiGatewayModel[]> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      log.warn("No AI gateway API key found, using fallback models");
      return fallbackModels as unknown as AiGatewayModel[];
    }

    const url = this.getModelsUrl();
    log.debug({ url }, "Fetching models from Vercel AI Gateway");

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
          "Vercel AI Gateway returned non-OK response"
        );
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const bodyRaw = await response.json();
      const body = aiGatewayModelsResponseSchema.parse(bodyRaw);
      const modelCount = body.data?.length ?? 0;

      log.info(
        { modelCount },
        "Successfully fetched models from Vercel AI Gateway"
      );
      return body.data || [];
    } catch (error) {
      log.error(
        { err: error, url },
        "Error fetching models from Vercel AI Gateway, falling back to generated models"
      );
      return fallbackModels as unknown as AiGatewayModel[];
    }
  }
}
