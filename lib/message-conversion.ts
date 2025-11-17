import type { ModelId } from "@airegistry/vercel-gateway";
import type { Chat, DBMessage } from "@/lib/db/schema";
import type { UIChat } from "@/lib/types/ui-chat";
import type { ChatMessage, UiToolName } from "./ai/types";

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

export function dbMessageToChatMessage(message: DBMessage): ChatMessage {
  // Note: This function should not be used directly for messages with parts from the database
  // Use getAllMessagesByChatId which reconstructs parts from Part table
  // For authenticated users, parts are stored in Part table
  // For anonymous users, parts are stored directly in the message object

  // Check if this is an AnonymousMessage (has parts field)
  const parts = "parts" in message && Array.isArray(message.parts)
    ? message.parts as ChatMessage["parts"]
    : []; // Parts are stored in Part table for authenticated users

  return {
    id: message.id,
    parts,
    role: message.role as ChatMessage["role"],
    metadata: {
      createdAt: message.createdAt,
      isPartial: message.isPartial,
      parentMessageId: message.parentMessageId,
      selectedModel: (message.selectedModel as ModelId) || ("" as ModelId),
      selectedTool: (message.selectedTool as UiToolName | null) || undefined,
    },
  };
}

export function chatMessageToDbMessage(
  message: ChatMessage,
  chatId: string
): DBMessage {
  const parentMessageId = message.metadata.parentMessageId || null;
  const isPartial = message.metadata.isPartial ?? false;
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
    isPartial,
    parentMessageId,
    selectedModel,
    selectedTool: message.metadata?.selectedTool || null,
  };
}
