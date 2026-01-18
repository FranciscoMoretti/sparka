import { Output, streamText } from "ai";
import { z } from "zod";
import type { AppModelId } from "@/lib/ai/app-models";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { CodeArtifact } from "../schemas";
import type { ArtifactMessageStreamWriter } from "../types";

export async function streamCodeArtifact({
  dataStream,
  costAccumulator,
  costModelId,
  costEvent,
  streamTextParams,
}: {
  dataStream: ArtifactMessageStreamWriter<"code">;
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

    const delta = code - content;
    if (code) {
      dataStream.write({
        type: "data-codeDelta",
        data: code ?? "",
        transient: true,
      });

      content = CodeArtifact.reduceDelta(content, code);
    }
  }

  const usage = await result.usage;
  if (usage) {
    costAccumulator?.addLLMCost(costModelId, usage, costEvent);
  }

  return content;
}
