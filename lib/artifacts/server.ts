import type { ModelId } from "@/lib/ai/models";
import { codeDocumentHandler } from "@/lib/artifacts/code/server";
import { sheetDocumentHandler } from "@/lib/artifacts/sheet/server";
import { textDocumentHandler } from "@/lib/artifacts/text/server";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import type { StreamWriter } from "../ai/types";
import type { Document } from "../db/schema";
import type { ArtifactKind } from "./artifact-kind";

export type CreateDocumentCallbackProps = {
  dataStream: StreamWriter;
  prompt: string;
  selectedModel: ModelId;
  costAccumulator?: CostAccumulator;
};

export type UpdateDocumentCallbackProps = {
  document: Document;
  prompt: string;
  dataStream: StreamWriter;
  selectedModel: ModelId;
  costAccumulator?: CostAccumulator;
};

export type DocumentHandler<T = ArtifactKind> = {
  kind: T;
  generate: (args: CreateDocumentCallbackProps) => Promise<string>;
  update: (args: UpdateDocumentCallbackProps) => Promise<string>;
};

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  generate: (params: CreateDocumentCallbackProps) => Promise<string>;
  update: (params: UpdateDocumentCallbackProps) => Promise<string>;
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
export const documentHandlersByArtifactKind: DocumentHandler[] = [
  textDocumentHandler,
  codeDocumentHandler,
  sheetDocumentHandler,
];
