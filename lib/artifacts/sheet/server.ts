import { Output, streamText } from "ai";
import { z } from "zod";
import type { AppModelId } from "@/lib/ai/app-models";
import { sheetPrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const sheetDocumentHandler = createDocumentHandler<"sheet">({
  kind: "sheet",
  generate: async ({
    title: _title,
    description: _description,
    dataStream,
    prompt,
    selectedModel,
    costAccumulator,
  }) => {
    let draftContent = "";

    const result = streamText({
      model: await getLanguageModel(selectedModel),
      system: sheetPrompt,
      experimental_telemetry: { isEnabled: true },
      prompt,
      output: Output.object({
        schema: z.object({
          csv: z.string().describe("CSV data"),
        }),
      }),
    });

    for await (const partialObject of result.partialOutputStream) {
      const { csv } = partialObject;

      if (csv) {
        dataStream.write({
          type: "data-sheetDelta",
          data: csv,
          transient: true,
        });

        draftContent = csv;
      }
    }

    dataStream.write({
      type: "data-sheetDelta",
      data: draftContent,
      transient: true,
    });

    const usage = await result.usage;
    costAccumulator?.addLLMCost(
      selectedModel as AppModelId,
      usage,
      "createDocument-sheet"
    );

    return draftContent;
  },
  update: async ({
    document,
    description,
    dataStream,
    selectedModel,
    costAccumulator,
  }) => {
    let draftContent = "";

    const result = streamText({
      model: await getLanguageModel(selectedModel),
      system: updateDocumentPrompt(document.content, "sheet"),
      experimental_telemetry: { isEnabled: true },
      prompt: description,
      output: Output.object({
        schema: z.object({
          csv: z.string(),
        }),
      }),
    });

    for await (const partialObject of result.partialOutputStream) {
      const { csv } = partialObject;

      if (csv) {
        dataStream.write({
          type: "data-sheetDelta",
          data: csv,
          transient: true,
        });

        draftContent = csv;
      }
    }

    const usage = await result.usage;
    costAccumulator?.addLLMCost(
      selectedModel as AppModelId,
      usage,
      "updateDocument-sheet"
    );

    return draftContent;
  },
});
