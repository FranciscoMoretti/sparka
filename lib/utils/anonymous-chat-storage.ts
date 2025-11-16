import { getAnonymousSession } from "@/lib/anonymous-session-client";
import type { AnonymousChat, AnonymousMessage } from "@/lib/types/anonymous";
import { cloneMessagesWithDocuments } from "../clone-messages";
import type { Document } from "../db/schema";

const ANONYMOUS_CHATS_KEY = "anonymous-chats";
const ANONYMOUS_MESSAGES_KEY = "anonymous-messages";
const ANONYMOUS_DOCUMENTS_KEY = "anonymous-documents";

export function loadAnonymousMessagesFromStorage(): AnonymousMessage[] {
  try {
    const session = getAnonymousSession();
    if (!session) {
      return [];
    }

    const savedMessages = localStorage.getItem(ANONYMOUS_MESSAGES_KEY);
    if (!savedMessages) {
      return [];
    }

    const parsedMessages = JSON.parse(savedMessages) as AnonymousMessage[];
    // Convert dates for all messages
    const messagesWithDates = parsedMessages.map((message) => ({
      ...message,
      createdAt: new Date(message.createdAt),
    }));

    return messagesWithDates;
  } catch (error) {
    console.error("Error loading anonymous messages:", error);
    return [];
  }
}

export function deleteAnonymousChat(chatId: string): Promise<boolean> {
  try {
    const session = getAnonymousSession();
    if (!session) {
      return Promise.resolve(false);
    }

    // Get messages for this chat BEFORE removing them
    const existingMessages = JSON.parse(
      localStorage.getItem(ANONYMOUS_MESSAGES_KEY) || "[]"
    );
    const messageIdsInChat = existingMessages
      .filter((m: AnonymousMessage) => m.chatId === chatId)
      .map((m: AnonymousMessage) => m.id);

    // Remove chat from localStorage
    const existingChats = JSON.parse(
      localStorage.getItem(ANONYMOUS_CHATS_KEY) || "[]"
    );
    const filteredChats = existingChats.filter(
      (c: AnonymousChat) => !(c.id === chatId && c.userId === session.id)
    );
    localStorage.setItem(ANONYMOUS_CHATS_KEY, JSON.stringify(filteredChats));

    // Remove messages for this chat
    const filteredMessages = existingMessages.filter(
      (m: AnonymousMessage) => m.chatId !== chatId
    );
    localStorage.setItem(
      ANONYMOUS_MESSAGES_KEY,
      JSON.stringify(filteredMessages)
    );

    // Remove documents for messages in this chat
    const existingDocuments = JSON.parse(
      localStorage.getItem(ANONYMOUS_DOCUMENTS_KEY) || "[]"
    );
    const filteredDocuments = existingDocuments.filter(
      (d: any) => !messageIdsInChat.includes(d.messageId)
    );
    localStorage.setItem(
      ANONYMOUS_DOCUMENTS_KEY,
      JSON.stringify(filteredDocuments)
    );

    return Promise.resolve(true);
  } catch (error) {
    console.error("Error deleting anonymous chat:", error);
    return Promise.resolve(false);
  }
}

export function renameAnonymousChat(chatId: string, title: string): void {
  try {
    const session = getAnonymousSession();
    if (!session) {
      return;
    }

    // Update chat in localStorage
    const existingChats = JSON.parse(
      localStorage.getItem(ANONYMOUS_CHATS_KEY) || "[]"
    );
    const updatedChats = existingChats.map((c: AnonymousChat) =>
      c.id === chatId && c.userId === session.id ? { ...c, title } : c
    );
    localStorage.setItem(ANONYMOUS_CHATS_KEY, JSON.stringify(updatedChats));
  } catch (error) {
    console.error("Error renaming anonymous chat:", error);
  }
}

export function pinAnonymousChat(chatId: string, isPinned: boolean): void {
  try {
    const session = getAnonymousSession();
    if (!session) {
      return;
    }

    // Update chat in localStorage
    const existingChats = JSON.parse(
      localStorage.getItem(ANONYMOUS_CHATS_KEY) || "[]"
    );
    const updatedChats = existingChats.map((c: AnonymousChat) =>
      c.id === chatId && c.userId === session.id ? { ...c, isPinned } : c
    );
    localStorage.setItem(ANONYMOUS_CHATS_KEY, JSON.stringify(updatedChats));
  } catch (error) {
    console.error("Error pinning anonymous chat:", error);
    return;
  }
}

// Module-level functions for chat operations
export function saveAnonymousChatToStorage(
  chat: Omit<AnonymousChat, "userId">
): void {
  try {
    const session = getAnonymousSession();
    if (!session) {
      throw new Error("No anonymous session");
    }

    const savedChats = localStorage.getItem("anonymous-chats");
    const chats = savedChats ? JSON.parse(savedChats) : [];

    const chatToSave = {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt.toISOString(),
      updatedAt: chat.updatedAt.toISOString(),
      visibility: chat.visibility,
      isPinned: chat.isPinned,
      projectId: chat.projectId ?? null,
      userId: session.id,
    };

    const existingIndex = chats.findIndex(
      (c: AnonymousChat) => c.id === chat.id
    );
    if (existingIndex >= 0) {
      chats[existingIndex] = chatToSave;
    } else {
      chats.push(chatToSave);
    }

    localStorage.setItem("anonymous-chats", JSON.stringify(chats));
  } catch (error) {
    console.error("Error saving anonymous chat:", error);
    throw error;
  }
}
export async function deleteAnonymousTrailingMessages(
  messageId: string
): Promise<void> {
  try {
    const session = getAnonymousSession();
    if (!session) {
      throw new Error("No anonymous session found");
    }

    const allMessages = await loadAnonymousMessagesFromStorage();

    console.log("Found ", allMessages);
    // Find the message with the given ID
    const targetMessage = allMessages.find(
      (m: AnonymousMessage) => m.id === messageId
    );
    if (!targetMessage) {
      console.warn(
        "Target message not found for deleteAnonymousTrailingMessages"
      );
      return;
    }

    // Get all messages for the same chat, sorted by creation time
    const chatMessages = allMessages
      .filter((m: AnonymousMessage) => m.chatId === targetMessage.chatId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Find the index of the target message in the sorted chat messages
    const targetIndex = chatMessages.findIndex((m) => m.id === messageId);

    if (targetIndex === -1) {
      console.warn("Target message not found in chat messages");
      return;
    }

    // Get messages to keep: all messages from other chats + messages up to and NOT including the target message
    const messagesToKeep = chatMessages.slice(0, targetIndex);
    const messageIdsToKeep = new Set(messagesToKeep.map((m) => m.id));

    // Get messages that will be deleted (for document cleanup)
    const messagesToDelete = chatMessages.slice(targetIndex);
    const messageIdsToDelete = messagesToDelete.map((m) => m.id);

    // Filter to keep messages from other chats and messages up to the target message
    const updatedMessages = allMessages.filter((m: AnonymousMessage) => {
      if (m.chatId !== targetMessage.chatId) {
        return true; // Keep messages from other chats
      }
      return messageIdsToKeep.has(m.id); // Keep only messages up to and including target
    });

    // Remove documents associated with deleted messages
    const allDocuments = await loadAnonymousDocumentsFromStorage();
    const updatedDocuments = allDocuments.filter(
      (d: any) => !messageIdsToDelete.includes(d.messageId)
    );

    // Update cache and save to localStorage
    localStorage.setItem(
      ANONYMOUS_MESSAGES_KEY,
      JSON.stringify(updatedMessages)
    );
    localStorage.setItem(
      ANONYMOUS_DOCUMENTS_KEY,
      JSON.stringify(updatedDocuments)
    );
  } catch (error) {
    console.error("Error deleting anonymous trailing messages:", error);
    throw error;
  }
}
export async function saveAnonymousMessage(
  message: AnonymousMessage
): Promise<void> {
  try {
    const session = getAnonymousSession();
    if (!session) {
      throw new Error("No anonymous session found");
    }

    const allMessages = await loadAnonymousMessagesFromStorage();
    allMessages.push(message);

    localStorage.setItem(ANONYMOUS_MESSAGES_KEY, JSON.stringify(allMessages));

    // Update the chat's updatedAt timestamp
    const existingChats = JSON.parse(
      localStorage.getItem(ANONYMOUS_CHATS_KEY) || "[]"
    );
    const updatedChats = existingChats.map((c: AnonymousChat) => {
      if (c.id === message.chatId && c.userId === session.id) {
        return { ...c, updatedAt: new Date().toISOString() };
      }
      return c;
    });
    localStorage.setItem(ANONYMOUS_CHATS_KEY, JSON.stringify(updatedChats));
  } catch (error) {
    console.error("Error saving anonymous message:", error);
    throw error;
  }
}
export async function loadLocalAnonymousMessagesByChatId(
  chatId: string
): Promise<AnonymousMessage[]> {
  const messages = await loadAnonymousMessagesFromStorage();
  return messages
    .filter((message) => message.chatId === chatId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function cloneAnonymousChat(
  originalMessages: AnonymousMessage[],
  originalChat: AnonymousChat,
  originalDocuments: Document[],
  newChatId: string
): Promise<void> {
  try {
    const session = getAnonymousSession();
    if (!session) {
      throw new Error("No anonymous session found");
    }

    if (originalMessages.length === 0) {
      throw new Error("Source chat has no messages to copy");
    }

    // Clone messages and documents with updated IDs
    const { clonedMessages, clonedDocuments } = cloneMessagesWithDocuments(
      originalMessages,
      originalDocuments,
      newChatId,
      session.id // Use anonymous session ID as user ID
    );

    // Note: Attachments are not cloned for anonymous/local users
    // Anonymous users rely on localStorage and don't have blob storage access
    // Original attachment URLs will remain in the cloned messages

    // Save all cloned messages
    const allMessages = await loadAnonymousMessagesFromStorage();
    const updatedMessages = [...allMessages, ...clonedMessages];
    localStorage.setItem(
      ANONYMOUS_MESSAGES_KEY,
      JSON.stringify(updatedMessages)
    );

    // Save all cloned documents if any exist
    if (clonedDocuments.length > 0) {
      const allDocuments = await loadAnonymousDocumentsFromStorage();
      const updatedDocuments = [...allDocuments, ...clonedDocuments];
      localStorage.setItem(
        ANONYMOUS_DOCUMENTS_KEY,
        JSON.stringify(updatedDocuments)
      );
    }

    // Create a new chat entry using the original chat data
    const newChat = {
      id: newChatId,
      title: `Copy of ${originalChat.title}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      visibility: "private" as const,
      isPinned: false, // New cloned chats are not pinned by default
      projectId: null,
    };

    await saveAnonymousChatToStorage(newChat);
  } catch (error) {
    console.error("Error copying anonymous chat:", error);
    throw error;
  }
}

export function loadAnonymousDocumentsFromStorage(): any[] {
  try {
    const session = getAnonymousSession();
    if (!session) {
      return [];
    }

    const savedDocuments = localStorage.getItem(ANONYMOUS_DOCUMENTS_KEY);
    if (!savedDocuments) {
      return [];
    }

    const parsedDocuments = JSON.parse(savedDocuments);

    return parsedDocuments.map((document: any) => ({
      ...document,
      createdAt: new Date(document.createdAt),
    }));
  } catch (error) {
    console.error("Error loading anonymous documents:", error);
    return [];
  }
}

export async function saveAnonymousDocument(document: any): Promise<void> {
  try {
    const session = getAnonymousSession();
    if (!session) {
      throw new Error("No anonymous session found");
    }

    const allDocuments = await loadAnonymousDocumentsFromStorage();
    allDocuments.push(document);

    localStorage.setItem(ANONYMOUS_DOCUMENTS_KEY, JSON.stringify(allDocuments));
  } catch (error) {
    console.error("Error saving anonymous document:", error);
    throw error;
  }
}

export async function loadAnonymousDocumentsByDocumentId(
  documentId: string
): Promise<any[]> {
  const documents = await loadAnonymousDocumentsFromStorage();
  return documents.filter((document) => document.id === documentId);
}

export function loadAnonymousChatsFromStorage(): AnonymousChat[] {
  try {
    const session = getAnonymousSession();
    if (!session) {
      return [];
    }

    const savedChats = localStorage.getItem(ANONYMOUS_CHATS_KEY);
    if (!savedChats) {
      return [];
    }

    const parsedChats = JSON.parse(savedChats) as AnonymousChat[];
    return parsedChats
      .filter((chat: AnonymousChat) => chat.userId === session.id)
      .map((chat: AnonymousChat) => ({
        ...chat,
        createdAt: new Date(chat.createdAt),
        updatedAt: new Date(chat.updatedAt || chat.createdAt),
        isPinned: chat.isPinned,
      }))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } catch (error) {
    console.error("Error loading anonymous chats:", error);
    return [];
  }
}

export function loadAnonymousChatById(chatId: string): AnonymousChat | null {
  try {
    const session = getAnonymousSession();
    if (!session) {
      return null;
    }

    const savedChats = localStorage.getItem(ANONYMOUS_CHATS_KEY);
    if (!savedChats) {
      return null;
    }

    const parsedChats = JSON.parse(savedChats) as AnonymousChat[];
    const chat = parsedChats.find(
      (c: AnonymousChat) => c.id === chatId && c.userId === session.id
    );

    if (!chat) {
      return null;
    }

    return {
      ...chat,
      createdAt: new Date(chat.createdAt),
      updatedAt: new Date(chat.updatedAt || chat.createdAt),
      isPinned: chat.isPinned,
    };
  } catch (error) {
    console.error("Error loading anonymous chat by ID:", error);
    return null;
  }
}
