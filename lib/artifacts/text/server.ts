import { smoothStream } from "ai";
import { updateDocumentPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";
import { streamTextArtifact } from "@/lib/artifacts/text/stream-text-artifact";

export const textDocumentHandler = createDocumentHandler<"text">({
  kind: "text",
  generate: async ({ dataStream, prompt, selectedModel, costAccumulator }) =>
    streamTextArtifact({
      dataStream,
      costAccumulator,
      costModelId: selectedModel,
      costEvent: "createDocument-text",
      streamTextParams: {
        model: await getLanguageModel(selectedModel),
        providerOptions: {
          telemetry: { isEnabled: true },
        },
        system:
          "Write about the given topic. Markdown is supported. Use headings wherever appropriate.",
        experimental_transform: smoothStream({ chunking: "word" }),
        prompt,
      },
    }),
  update: async ({
    document,
    prompt,
    dataStream,
    selectedModel,
    costAccumulator,
  }) =>
    streamTextArtifact({
      dataStream,
      costAccumulator,
      costModelId: selectedModel,
      costEvent: "updateDocument-text",
      streamTextParams: {
        model: await getLanguageModel(selectedModel),
        system: updateDocumentPrompt(document.content, "text"),
        experimental_transform: smoothStream({ chunking: "word" }),
        prompt,
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
      },
    }),
});
