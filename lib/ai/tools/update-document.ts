import { tool } from "ai";
import { z } from "zod";
import type { ModelId } from "@/lib/ai/app-models";
import type { ToolSession } from "@/lib/ai/tools/types";
import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";
import { documentHandlersByArtifactKind } from "@/lib/artifacts/server";
import type { ArtifactInfo } from "@/lib/artifacts/types";

import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { getDocumentById, saveDocument } from "@/lib/db/queries";
import type { StreamWriter } from "../types";

export const updateDocument = ({
  session,
  dataStream,
  messageId,
  selectedModel,
  costAccumulator,
}: {
  session: ToolSession;
  dataStream: StreamWriter;
  messageId: string;
  selectedModel: ModelId;
  costAccumulator?: CostAccumulator;
}) =>
  tool({
    description: `Modify an existing document.

Use for:
- Rewrite the whole document for major changes
- Make targeted edits for isolated changes
- Follow user instructions about which parts to touch
- Wait for user feedback before updating a freshly created document

Avoid:
- Updating immediately after the document was just created
- Using this tool if there is no previous document in the conversation

`,
    inputSchema: z.object({
      id: z.string().describe("The ID of the document to update"),
      prompt: z
        .string()
        .describe("The prompt for the changes that need to be made"),
    }),
    execute: async ({ id, prompt }) => {
      const document = await getDocumentById({ id });

      if (!document) {
        return {
          success: false as const,
          error: "Document not found",
        };
      }

      const artifactInfo: ArtifactInfo = {
        id: document.id,
        title: document.title,
        messageId,
        kind: document.kind as ArtifactKind,
      };

      dataStream.write({
        type: "data-artifactInfo",
        data: artifactInfo,
        transient: true,
      });

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind[document.kind];

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      const content = await documentHandler.update({
        document,
        prompt,
        dataStream,
        selectedModel,
        costAccumulator,
      });

      if (session?.user?.id) {
        await saveDocument({
          id: document.id,
          title: document.title,
          content,
          kind: document.kind,
          userId: session.user.id,
          messageId,
        });
      }

      dataStream.write({ type: "data-finish", data: null, transient: true });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content: "The document has been updated successfully.",
        success: true as const,
      };
    },
  });
