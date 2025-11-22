import { useChatStoreApi } from "@ai-sdk-tools/store";
import type { ChatMessage } from "@/lib/ai/types";
import { isLastArtifact } from "../is-last-artifact";
import {
  type CreateDocumentTool,
  DocumentToolResult,
  isArtifactToolResult,
} from "./document-common";
import { DocumentPreview } from "./document-preview";

export function CreateDocumentMessage({
  tool,
  isReadonly,
  messageId,
}: {
  tool: CreateDocumentTool;
  isReadonly: boolean;
  messageId: string;
}) {
  const chatStore = useChatStoreApi<ChatMessage>();
  if (tool.state === "input-available") {
    return (
      <DocumentPreview
        args={tool.input}
        isReadonly={isReadonly}
        messageId={messageId}
      />
    );
  }
  const { output, input, toolCallId } = tool;
  if (!output) {
    return null;
  }
  const shouldShowFullPreview = isLastArtifact(
    chatStore.getState().messages,
    toolCallId
  );
  if ("error" in output) {
    return (
      <div className="rounded border p-2 text-red-500">
        Error: {String(output.error)}
      </div>
    );
  }
  if (!isArtifactToolResult(output)) {
    return null;
  }
  return shouldShowFullPreview ? (
    <DocumentPreview
      args={input}
      isReadonly={isReadonly}
      messageId={messageId}
      result={output}
      type="create"
    />
  ) : (
    <DocumentToolResult
      isReadonly={isReadonly}
      messageId={messageId}
      result={output}
      type="create"
    />
  );
}
