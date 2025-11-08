import { tool } from "ai";
import type { FileUIPart } from "ai";
import { z } from "zod";
import { env } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";
import * as geminiService from "@/lib/rag/geminiService";

const log = createModuleLogger("ai.tools.gemini-rag");

type GeminiRagProps = {
  attachments?: FileUIPart[];
};

export const geminiRag = ({ attachments = [] }: GeminiRagProps) =>
  tool({
    description: `Query Gemini RAG with current attachments. The tool automatically creates an ephemeral RAG store, uploads attachments, performs the search, and tears down the store immediately after completion.

Use for:
- Querying uploaded documents/files with natural language questions
- Extracting information from PDFs, text files, or other document formats
- Getting answers based on document content

Requires file attachments to be present in the current message.`,
    inputSchema: z.object({
      query: z.string().describe("The question or query to search within the attached documents"),
    }),
    execute: async ({ query }) => {
      // Filter to file attachments only
      const fileAttachments = attachments.filter(
        (part) => part.type === "file"
      );

      if (fileAttachments.length === 0) {
        return {
          error: "No file attachments found. Please attach files to query.",
        };
      }

      // Initialize Gemini service
      geminiService.initialize();

      const storeName = `chat-session-${Date.now()}`;
      let ragStoreName: string | null = null;

      try {
        // Create RAG store
        ragStoreName = await geminiService.createRagStore(storeName);

        // Upload each file attachment
        for (const part of fileAttachments) {
          if (part.type === "file" && part.url) {
            // Fetch the file from URL
            const response = await fetch(part.url);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Create File object for upload
            const file = new File([buffer], part.filename || "file", {
              type: part.mediaType || "application/octet-stream",
            });

            await geminiService.uploadToRagStore(ragStoreName, file);
          }
        }

        // Perform file search
        const result = await geminiService.fileSearch(ragStoreName, query);

        return {
          text: result.text,
          groundingChunks: result.groundingChunks,
        };
      } finally {
        // Always tear down the store after search completes
        if (ragStoreName) {
          try {
            await geminiService.deleteRagStore(ragStoreName);
          } catch (error) {
            // Log but don't fail if teardown fails
            log.error({ error, ragStoreName }, "Failed to delete RAG store");
          }
        }
      }
    },
  });

