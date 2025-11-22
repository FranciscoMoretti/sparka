import { useChatStoreApi } from "@ai-sdk-tools/store";
import type { ChatMessage } from "@/lib/ai/types";
import { isLastArtifact } from "../is-last-artifact";
import {
  DocumentToolCall,
  DocumentToolResult,
  hasProp,
  isArtifactToolResult,
  type UpdateDocumentTool,
} from "./document-common";
import { DocumentPreview } from "./document-preview";

export function UpdateDocumentMessage({
  tool,
  isReadonly,
  messageId,
}: {
  tool: UpdateDocumentTool;
  isReadonly: boolean;
  messageId: string;
}) {
  const chatStore = useChatStoreApi<ChatMessage>();
  if (tool.state === "input-available") {
    const toolInput = tool.input;
    const title =
      hasProp(toolInput, "title") && typeof toolInput.title === "string"
        ? toolInput.title
        : undefined;
    return (
      <DocumentToolCall
        args={{ title }}
        isReadonly={isReadonly}
        type="update"
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
      type="update"
    />
  ) : (
    <DocumentToolResult
      isReadonly={isReadonly}
      messageId={messageId}
      result={output}
      type="update"
    />
  );
}
