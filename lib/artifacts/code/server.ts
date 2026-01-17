import { Output, streamText } from "ai";
import { z } from "zod";
import type { AppModelId } from "@/lib/ai/app-models";
import { codePrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const codeDocumentHandler = createDocumentHandler<"code">({
  kind: "code",
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
      system: codePrompt,
      prompt,
      experimental_telemetry: { isEnabled: true },
      output: Output.object({
        schema: z.object({
          code: z.string(),
        }),
      }),
    });

    for await (const partialObject of result.partialOutputStream) {
      const { code } = partialObject;

      if (code) {
        dataStream.write({
          type: "data-codeDelta",
          data: code ?? "",
          transient: true,
        });

        draftContent = code;
      }
    }

    const usage = await result.usage;
    costAccumulator?.addLLMCost(selectedModel, usage, "createDocument-code");

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
      system: updateDocumentPrompt(document.content || "", "code"),
      experimental_telemetry: { isEnabled: true },
      prompt: description,
      output: Output.object({
        schema: z.object({
          code: z.string(),
        }),
      }),
    });

    for await (const partialObject of result.partialOutputStream) {
      const { code } = partialObject;

      if (code) {
        dataStream.write({
          type: "data-codeDelta",
          data: code ?? "",
          transient: true,
        });

        draftContent = code;
      }
    }

    const usage = await result.usage;
    costAccumulator?.addLLMCost(
      selectedModel as AppModelId,
      usage,
      "updateDocument-code"
    );

    return draftContent;
  },
});
