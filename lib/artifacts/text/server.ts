import { smoothStream } from "ai";
import { updateDocumentPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { streamTextArtifact } from "@/lib/artifacts/text/stream-text-artifact";
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
  }) =>
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
    description,
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
      },
    }),
});
