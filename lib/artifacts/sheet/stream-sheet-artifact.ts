import { Output, streamText } from "ai";
import { z } from "zod";
import type { AppModelId } from "@/lib/ai/app-models";
import type { StreamWriter } from "@/lib/ai/types";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";

export async function streamSheetArtifact({
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
  streamTextParams: Omit<Parameters<typeof streamText>[0], "output">;
}): Promise<string> {
  let content = "";

  const result = streamText({
    ...streamTextParams,
    output: Output.object({
      schema: z.object({
        csv: z.string().describe("CSV data"),
      }),
    }),
  } as Parameters<typeof streamText>[0]);

  for await (const partialObject of result.partialOutputStream) {
    const { csv } = partialObject;

    if (csv) {
      dataStream.write({
        type: "data-sheetDelta",
        data: csv,
        transient: true,
      });

      content = csv;
    }
  }

  const usage = await result.usage;
  if (usage) {
    costAccumulator?.addLLMCost(costModelId, usage, costEvent);
  }

  return content;
}
