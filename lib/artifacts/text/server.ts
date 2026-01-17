import { smoothStream, streamText } from "ai";
import type { AppModelId } from "@/lib/ai/app-models";
import { updateDocumentPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

export const textDocumentHandler = createDocumentHandler<"text">({
  kind: "text",
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
      providerOptions: {
        telemetry: { isEnabled: true },
      },
      system:
        "Write about the given topic. Markdown is supported. Use headings wherever appropriate.",
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt,
    });

    for await (const delta of result.fullStream) {
      const { type } = delta;

      if (type === "text-delta") {
        const { text } = delta;

        draftContent += text;

        dataStream.write({
          type: "data-textDelta",
          data: text,
          transient: true,
        });
      }
    }

    const usage = await result.usage;
    costAccumulator?.addLLMCost(
      selectedModel as AppModelId,
      usage,
      "createDocument-text"
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
      system: updateDocumentPrompt(document.content, "text"),
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: description,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "refine-text",
      },
      providerOptions: {
        openai: {
          prediction: {
            type: "content",
            content: document.content,
          },
        },
      },
    });

    for await (const delta of result.fullStream) {
      const { type } = delta;

      if (type === "text-delta") {
        const { text } = delta;

        draftContent += text;
        dataStream.write({
          type: "data-textDelta",
          data: text,
          transient: true,
        });
      }
    }

    const usage = await result.usage;
    costAccumulator?.addLLMCost(
      selectedModel as AppModelId,
      usage,
      "updateDocument-text"
    );

    return draftContent;
  },
});
