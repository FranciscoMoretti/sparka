import { unstable_cache as cache } from "next/cache";
import { config } from "@/lib/config";
import type { AppModelId, ModelId } from "./app-model-id";
import type { ModelData } from "./model-data";
import { fetchModels } from "./models";
import {
  generatedForGateway,
  models as generatedModels,
} from "./models.generated";

export type { AppModelId, ModelId } from "./app-model-id";

export type AppModelDefinition = Omit<ModelData, "id"> & {
  id: AppModelId;
  apiModelId: ModelId;
};

const DISABLED_MODELS = new Set(config.ai.disabledModels);
const PROVIDER_ORDER = config.ai.providerOrder;

function buildAppModels(models: ModelData[]): AppModelDefinition[] {
  return models
    .flatMap((model) => {
      const modelId = model.id as ModelId;
      // If the model supports reasoning, return two variants:
      // - Non-reasoning (original id, reasoning=false)
      // - Reasoning (id with -reasoning suffix, reasoning=true)
      if (model.reasoning === true) {
        const reasoningId = `${modelId}-reasoning` as AppModelId;

        return [
          {
            ...model,
            id: reasoningId,
            apiModelId: modelId,
            disabled: DISABLED_MODELS.has(modelId),
          },
          {
            ...model,
            reasoning: false,
            apiModelId: modelId,
            disabled: DISABLED_MODELS.has(modelId),
          },
        ];
      }

      // Models without reasoning stay as-is
      return [
        {
          ...model,
          apiModelId: modelId,
          disabled: DISABLED_MODELS.has(modelId),
        },
      ];
    })
    .filter(
      (model) => model.type === "language" && !model.disabled
    ) as AppModelDefinition[];
}

function buildChatModels(
  appModels: AppModelDefinition[]
): AppModelDefinition[] {
  return appModels
    .filter((model) => model.output.text === true)
    .sort((a, b) => {
      const aProviderIndex = PROVIDER_ORDER.indexOf(a.owned_by);
      const bProviderIndex = PROVIDER_ORDER.indexOf(b.owned_by);

      const aIndex =
        aProviderIndex === -1 ? PROVIDER_ORDER.length : aProviderIndex;
      const bIndex =
        bProviderIndex === -1 ? PROVIDER_ORDER.length : bProviderIndex;

      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }

      return 0;
    });
}

const fetchAllAppModels = cache(
  async (): Promise<AppModelDefinition[]> => {
    const models = await fetchModels();
    return buildAppModels(models);
  },
  ["all-app-models"],
  { revalidate: 3600, tags: ["ai-gateway-models"] }
);

export const fetchChatModels = cache(
  async (): Promise<AppModelDefinition[]> => {
    const appModels = await fetchAllAppModels();
    return buildChatModels(appModels);
  },
  ["chat-models"],
  { revalidate: 3600, tags: ["ai-gateway-models"] }
);

export async function getAppModelDefinition(
  modelId: AppModelId
): Promise<AppModelDefinition> {
  const models = await fetchAllAppModels();
  const model = models.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }
  return model;
}

/**
 * Set of model IDs from the generated models file.
 * Used to detect new models from the API that we haven't "decided" on yet.
 * When the snapshot was generated for a different gateway the IDs won't match,
 * so we fall back to an empty set (which auto-enables all models).
 */
const KNOWN_MODEL_IDS = new Set<string>(
  generatedForGateway === config.ai.gateway
    ? generatedModels.map((m) => m.id)
    : []
);

/**
 * Returns the default enabled models for a given list of app models.
 * Includes curated defaults + any new models from the API not in models.generated.ts
 */
export function getDefaultEnabledModels(
  appModels: AppModelDefinition[]
): Set<AppModelId> {
  const enabled = new Set<AppModelId>(config.ai.curatedDefaults);

  // If a curated default has a -reasoning variant, enable it too
  for (const model of appModels) {
    if (model.id.endsWith("-reasoning") && enabled.has(model.apiModelId)) {
      enabled.add(model.id);
    }
  }

  // Add any new models from the API that aren't in our generated snapshot
  for (const model of appModels) {
    if (!KNOWN_MODEL_IDS.has(model.apiModelId)) {
      enabled.add(model.id);
    }
  }

  return enabled;
}
