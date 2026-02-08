import { unstable_cache } from "next/cache";
import { createModuleLogger } from "@/lib/logger";
import type { AiGatewayModel } from "./ai-gateway-models-schemas";
import { getActiveGateway } from "./gateways";
import type { ModelData } from "./model-data";
import { toModelData } from "./to-model-data";

const log = createModuleLogger("ai/models");

async function fetchModelsRaw(): Promise<AiGatewayModel[]> {
  const activeGateway = getActiveGateway();

  log.debug(
    { gateway: activeGateway.type, url: activeGateway.getModelsUrl() },
    "Fetching models from gateway"
  );

  try {
    const models = await activeGateway.fetchModels();
    log.info(
      { gateway: activeGateway.type, modelCount: models.length },
      "Successfully fetched models from gateway"
    );
    return models;
  } catch (error) {
    log.error(
      { err: error, gateway: activeGateway.type },
      "Error fetching models from gateway"
    );
    throw error;
  }
}

export const fetchModels = unstable_cache(
  async (): Promise<ModelData[]> => {
    const models = await fetchModelsRaw();
    return models.map(toModelData);
  },
  ["ai-gateway-models"],
  {
    revalidate: 3600,
    tags: ["ai-gateway-models"],
  }
);
