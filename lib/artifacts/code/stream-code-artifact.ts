import { Output, streamText } from "ai";
import { z } from "zod";
import type { AppModelId } from "@/lib/ai/app-models";
import type { StreamWriter } from "@/lib/ai/types";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";

export async function streamCodeArtifact({
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
        code: z.string(),
      }),
    }),
  } as Parameters<typeof streamText>[0]);

  for await (const partialObject of result.partialOutputStream) {
    const { code } = partialObject;

    if (code) {
      dataStream.write({
        type: "data-codeDelta",
        data: code ?? "",
        transient: true,
      });

      content = code;
    }
  }

  const usage = await result.usage;
  if (usage) {
    costAccumulator?.addLLMCost(costModelId, usage, costEvent);
  }

  return content;
}
