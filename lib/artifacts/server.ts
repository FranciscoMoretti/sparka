import type { ModelId } from "@/lib/ai/models";
import { codeDocumentHandler } from "@/lib/artifacts/code/server";
import { sheetDocumentHandler } from "@/lib/artifacts/sheet/server";
import { textDocumentHandler } from "@/lib/artifacts/text/server";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import type { Document } from "../db/schema";
import type { ArtifactKind } from "./artifact-kind";
import type { ArtifactMessageStreamWriter } from "./types";

export type CreateDocumentCallbackProps<K extends ArtifactKind> = {
  dataStream: ArtifactMessageStreamWriter<K>;
  prompt: string;
  selectedModel: ModelId;
  costAccumulator?: CostAccumulator;
};

export type UpdateDocumentCallbackProps<K extends ArtifactKind> = {
  document: Document;
  prompt: string;
  dataStream: ArtifactMessageStreamWriter<K>;
  selectedModel: ModelId;
  costAccumulator?: CostAccumulator;
};

export type DocumentHandler<T extends ArtifactKind = ArtifactKind> = {
  kind: T;
  generate: (args: CreateDocumentCallbackProps<T>) => Promise<string>;
  update: (args: UpdateDocumentCallbackProps<T>) => Promise<string>;
};

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  generate: (params: CreateDocumentCallbackProps<T>) => Promise<string>;
  update: (params: UpdateDocumentCallbackProps<T>) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    generate: config.generate,
    update: config.update,
  };
}

/*
 * Use this array to define the document handlers for each artifact kind.
 */
export const documentHandlersByArtifactKind: {
  [K in ArtifactKind]: DocumentHandler<K>;
} = {
  text: textDocumentHandler,
  code: codeDocumentHandler,
  sheet: sheetDocumentHandler,
};
