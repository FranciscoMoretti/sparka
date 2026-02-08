import { writeFileSync } from "node:fs";
import { getActiveGateway } from "../lib/ai/gateways";

async function fetchAndSaveModels() {
  const gateway = getActiveGateway();

  const apiKey = gateway.getApiKey();
  if (!apiKey) {
    throw new Error(`No API key configured for gateway '${gateway.type}'`);
  }

  console.log(`Fetching models from '${gateway.type}' gateway...`);
  const models = await gateway.fetchModels();

  if (!models || models.length === 0) {
    throw new Error("No models returned from gateway");
  }

  const fileContent = `import type { AiGatewayModel } from "@/lib/ai/ai-gateway-models-schemas";

export const models = ${JSON.stringify(models, null, 2)} as const satisfies readonly AiGatewayModel[];
`;

  writeFileSync("lib/ai/models.generated.ts", fileContent);
  console.log(
    `Wrote ${models.length} models from '${gateway.type}' gateway to lib/ai/models.generated.ts`
  );
}

fetchAndSaveModels();
