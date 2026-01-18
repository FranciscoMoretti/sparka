import { sheetPrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";
import { streamSheetArtifact } from "@/lib/artifacts/sheet/stream-sheet-artifact";

export const sheetDocumentHandler = createDocumentHandler<"sheet">({
  kind: "sheet",
  generate: async ({ dataStream, prompt, selectedModel, costAccumulator }) =>
    streamSheetArtifact({
      dataStream,
      costAccumulator,
      costModelId: selectedModel,
      costEvent: "createDocument-sheet",
      streamTextParams: {
        model: await getLanguageModel(selectedModel),
        system: sheetPrompt,
        experimental_telemetry: { isEnabled: true },
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
    streamSheetArtifact({
      dataStream,
      costAccumulator,
      costModelId: selectedModel,
      costEvent: "updateDocument-sheet",
      streamTextParams: {
        model: await getLanguageModel(selectedModel),
        system: updateDocumentPrompt(document.content, "sheet"),
        experimental_telemetry: { isEnabled: true },
        prompt,
      },
    }),
});
