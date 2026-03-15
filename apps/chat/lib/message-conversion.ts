import type { ModelId } from "@/lib/ai/app-models";
import type { Chat, DBMessage } from "@/lib/db/schema";
import type { UIChat } from "@/lib/types/ui-chat";
import {
  isSelectedModelValue,
  type ChatMessage,
  type UiToolName,
} from "./ai/types";

// Helper functions for type conversion
export function dbChatToUIChat(chat: Chat): UIChat {
  return {
    id: chat.id,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    title: chat.title,
    visibility: chat.visibility,
    userId: chat.userId,
    isPinned: chat.isPinned,
    projectId: chat.projectId ?? null,
  };
}

function _dbMessageToChatMessage(message: DBMessage): ChatMessage {
  // Note: This function should not be used directly for messages with parts
  // Use getAllMessagesByChatId which reconstructs parts from Part table
  // Parts are now stored in Part table, not in Message.parts
  return {
    id: message.id,
    parts: [], // Parts are stored in Part table - use getAllMessagesByChatId instead
    role: message.role as ChatMessage["role"],
    metadata: {
      createdAt: message.createdAt,
      activeStreamId: message.activeStreamId,
      parentMessageId: message.parentMessageId,
      parallelGroupId: message.parallelGroupId,
      parallelIndex: message.parallelIndex,
      isPrimaryParallel: message.isPrimaryParallel,
      selectedModel: isSelectedModelValue(message.selectedModel)
        ? message.selectedModel
        : ("" as ModelId),
      selectedTool: (message.selectedTool as UiToolName | null) || undefined,
      usage: message.lastContext as ChatMessage["metadata"]["usage"],
    },
  };
}

export function chatMessageToDbMessage(
  message: ChatMessage,
  chatId: string
): DBMessage {
  const parentMessageId = message.metadata.parentMessageId || null;
  const selectedModel = message.metadata.selectedModel;

  // Ensure createdAt is a Date object
  let createdAt: Date;
  if (message.metadata?.createdAt) {
    createdAt =
      message.metadata.createdAt instanceof Date
        ? message.metadata.createdAt
        : new Date(message.metadata.createdAt);
  } else {
    createdAt = new Date();
  }

  // Parts are stored in Part table, not in Message.parts
  return {
    id: message.id,
    chatId,
    role: message.role,
    attachments: [],
    lastContext: message.metadata?.usage || null,
    createdAt,
    annotations: [],
    parentMessageId,
    selectedModel,
    selectedTool: message.metadata?.selectedTool || null,
    parallelGroupId: message.metadata?.parallelGroupId || null,
    parallelIndex: message.metadata?.parallelIndex ?? null,
    isPrimaryParallel: message.metadata?.isPrimaryParallel ?? null,
    activeStreamId: message.metadata?.activeStreamId || null,
    canceledAt: null,
  };
}
