import { codePrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { streamCodeArtifact } from "@/lib/artifacts/code/stream-code-artifact";
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
  }) =>
    streamCodeArtifact({
      dataStream,
      costAccumulator,
      costModelId: selectedModel,
      costEvent: "createDocument-code",
      streamTextParams: {
        model: await getLanguageModel(selectedModel),
        system: codePrompt,
        prompt,
        experimental_telemetry: { isEnabled: true },
      },
    }),
  update: async ({
    document,
    description,
    dataStream,
    selectedModel,
    costAccumulator,
  }) =>
    streamCodeArtifact({
      dataStream,
      costAccumulator,
      costModelId: selectedModel,
      costEvent: "updateDocument-code",
      streamTextParams: {
        model: await getLanguageModel(selectedModel),
        system: updateDocumentPrompt(document.content || "", "code"),
        experimental_telemetry: { isEnabled: true },
        prompt: description,
      },
    }),
});
