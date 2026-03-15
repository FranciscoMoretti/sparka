import {
  useChatActions,
  useChatStatus,
  useChatStoreApi,
} from "@ai-sdk-tools/store";
import { RefreshCcw } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { Action } from "@/components/ai-elements/actions";
import { getPrimarySelectedModelId, type ChatMessage } from "@/lib/ai/types";

export function RetryButton({
  messageId,
  className,
}: {
  messageId: string;
  className?: string;
}) {
  const { setMessages, sendMessage } = useChatActions<ChatMessage>();
  const chatStore = useChatStoreApi<ChatMessage>();
  const status = useChatStatus();

  const handleRetry = useCallback(() => {
    if (!sendMessage) {
      toast.error("Cannot retry this message");
      return;
    }

    // Find the current message (AI response) and its parent (user message)
    const currentMessages = chatStore.getState().messages;
    const currentMessage = currentMessages.find((msg) => msg.id === messageId);
    if (!currentMessage) {
      toast.error("Cannot find the message to retry");
      return;
    }

    const parentMessageId = currentMessage.metadata?.parentMessageId ?? null;
    if (!parentMessageId) {
      toast.error("Cannot find the user message to retry");
      return;
    }

    const parentMessageIdx = currentMessages.findIndex(
      (msg) => msg.id === parentMessageId
    );
    if (parentMessageIdx < 0) {
      toast.error("Cannot find the user message to retry");
      return;
    }

    const parentMessage = currentMessages[parentMessageIdx];
    if (parentMessage.role !== "user") {
      toast.error("Parent message is not from user");
      return;
    }

    const retryModelId =
      getPrimarySelectedModelId(currentMessage.metadata?.selectedModel) ||
      getPrimarySelectedModelId(parentMessage.metadata?.selectedModel);

    if (!retryModelId) {
      toast.error("Cannot determine which model to retry");
      return;
    }

    setMessages(currentMessages.slice(0, parentMessageIdx));

    // Resend the parent user message
    sendMessage(
      {
        ...parentMessage,
        metadata: {
          ...parentMessage.metadata,
          createdAt: parentMessage.metadata?.createdAt || new Date(),
          parallelGroupId: null,
          parallelIndex: null,
          isPrimaryParallel: null,
          selectedModel: retryModelId,
          parentMessageId: parentMessage.metadata?.parentMessageId || null,
        },
      },
      {}
    );

    toast.success("Retrying message...");
  }, [sendMessage, messageId, setMessages, chatStore]);

  if (status === "streaming" || status === "submitted") {
    return null;
  }

  return (
    <Action
      className={`h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground p-0${
        className ? ` ${className}` : ""
      }`}
      onClick={handleRetry}
      tooltip="Retry"
    >
      <RefreshCcw className="h-3.5 w-3.5" />
    </Action>
  );
}
