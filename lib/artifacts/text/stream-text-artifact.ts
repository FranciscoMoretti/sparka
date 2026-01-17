import { streamText } from "ai";
import type { AppModelId } from "@/lib/ai/app-models";
import type { StreamWriter } from "@/lib/ai/types";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";

export async function streamTextArtifact({
  dataStream,
  costAccumulator,
  costModelId,
  costEvent,
  streamTextParams,
}: {
  dataStream: StreamWriter;
  costAccumulator?: CostAccumulator;
  costModelId: AppModelId;
  costEvent: string;
  streamTextParams: Parameters<typeof streamText>[0];
}): Promise<string> {
  const result = streamText(streamTextParams);
  let content = "";

  for await (const delta of result.fullStream) {
    if (delta.type === "text-delta") {
      content += delta.text;
      dataStream.write({
        type: "data-textDelta",
        data: delta.text,
        transient: true,
      });
    }
  }

  const usage = await result.usage;
  if (usage) {
    costAccumulator?.addLLMCost(costModelId, usage, costEvent);
  }

  return content;
}
