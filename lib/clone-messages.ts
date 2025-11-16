import type { FileUIPart } from "ai";
import type { ChatMessage } from "./ai/types";
import { uploadFile } from "./blob";
import { generateUUID } from "./utils";

function cloneMessages<
  T extends { id: string; chatId: string; parentMessageId?: string | null },
>(sourceMessages: T[], newChatId: string): T[] {
  // First pass: Create mapping from old IDs to new IDs
  const idMap = new Map<string, string>();
  for (const message of sourceMessages) {
    idMap.set(message.id, generateUUID());
  }

  // Second pass: Clone messages using the ID mapping
  const clonedMessages: T[] = [];
  for (const message of sourceMessages) {
    const newId = idMap.get(message.id);
    if (!newId) {
      throw new Error(`Message ID ${message.id} not found in mapping`);
    }

    let newParentId: string | null = null;
    if (message.parentMessageId) {
      newParentId = idMap.get(message.parentMessageId) || null;
      if (!newParentId) {
        throw new Error(
          `Parent message ID ${message.parentMessageId} not found in mapping`
        );
      }
    }

    const clonedMessage: T = {
      ...message,
      id: newId,
      chatId: newChatId,
      parentMessageId: newParentId,
    };
    clonedMessages.push(clonedMessage);
  }

  return clonedMessages;
}
function createDocumentIdMap<T extends { id: string }>(
  documents: T[]
): Map<string, string> {
  const documentIdMap = new Map<string, string>();
  for (const document of documents) {
    documentIdMap.set(document.id, generateUUID());
  }
  return documentIdMap;
}

function updateDocumentIdInPart(
  part: any,
  documentIdMap: Map<string, string>
): any {
  const oldDocId = part.output?.id;
  const newDocId = documentIdMap.get(oldDocId);
  if (newDocId) {
    return {
      ...part,
      output: {
        ...part.output,
        id: newDocId,
      },
    };
  }
  throw new Error(`Document ID ${oldDocId} not found in mapping`);
}

function updatePartDocumentReferences(
  part: ChatMessage["parts"][number],
  documentIdMap: Map<string, string>
): ChatMessage["parts"][number] {
  if (part.type === "tool-deepResearch") {
    if (part.state !== "output-available") {
      return part;
    }
    if (part.output?.format === "report") {
      return updateDocumentIdInPart(part, documentIdMap);
    }
    return part;
  }

  if (part.type === "tool-updateDocument") {
    if (part.state !== "output-available") {
      return part;
    }

    if (!part.output.success) {
      return part;
    }

    return updateDocumentIdInPart(part, documentIdMap);
  }

  if (part.type === "tool-createDocument") {
    if (part.state !== "output-available") {
      return part;
    }

    return updateDocumentIdInPart(part, documentIdMap);
  }

  return part;
}
function updateDocumentReferencesInMessageParts<
  T extends { parts: ChatMessage["parts"] },
>(messages: T[], documentIdMap: Map<string, string>): T[] {
  return messages.map((message) => {
    const parts = message.parts;
    let updatedParts: ChatMessage["parts"] = [];

    if (Array.isArray(parts)) {
      updatedParts = parts.map((part) =>
        updatePartDocumentReferences(part, documentIdMap)
      );
    }

    return {
      ...message,
      parts: updatedParts,
    };
  });
}
function cloneDocuments<
  T extends { id: string; messageId: string; userId: string },
>(
  sourceDocuments: T[],
  documentIdMap: Map<string, string>,
  messageIdMap: Map<string, string>,
  newUserId: string
): T[] {
  const clonedDocuments: T[] = [];

  for (const document of sourceDocuments) {
    const newDocumentId = documentIdMap.get(document.id);
    const newMessageId = messageIdMap.get(document.messageId);

    if (!newDocumentId) {
      throw new Error(`Document ID ${document.id} not found in mapping`);
    }
    if (!newMessageId) {
      throw new Error(`Message ID ${document.messageId} not found in mapping`);
    }

    const clonedDocument: T = {
      ...document,
      id: newDocumentId,
      messageId: newMessageId,
      userId: newUserId,
    };
    clonedDocuments.push(clonedDocument);
  }

  return clonedDocuments;
}

export async function cloneFileUIPart(part: FileUIPart): Promise<FileUIPart> {
  try {
    // Skip if no URL is provided
    if (!part.url) {
      console.warn("Attachment has no URL, skipping clone");
      return part;
    }

    // Skip if URL is not a blob URL (might be external)
    if (!part.url.includes("blob.vercel-storage.com")) {
      console.warn(
        "Attachment is not a Vercel blob, skipping clone:",
        part.url
      );
      return part;
    }

    // Fetch the original file
    const response = await fetch(part.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch attachment: ${response.statusText}`);
    }

    const blob = await response.blob();

    // Extract just the base filename without any path components
    let filename = part.filename || "attachment";

    // If filename contains path separators, get just the last part
    if (filename.includes("/")) {
      filename = filename.split("/").pop() || "attachment";
    }

    // Remove any existing prefix if it somehow got into the filename
    if (filename.startsWith("sparka-ai/files/")) {
      filename = filename.replace("sparka-ai/files/", "");
    }

    const newBlob = await uploadFile(
      filename,
      Buffer.from(await blob.arrayBuffer())
    );

    return {
      ...part,
      url: newBlob.url,
    };
  } catch (error) {
    console.error("Failed to clone attachment:", error);
    // Return original attachment as fallback to avoid breaking the cloning process
    return part;
  }
}

export async function cloneAttachmentsInMessages<
  T extends { parts: ChatMessage["parts"] },
>(messages: T[]): Promise<T[]> {
  const clonedMessages: T[] = [];

  for (const message of messages) {
    if (message.parts && Array.isArray(message.parts)) {
      const clonedParts: ChatMessage["parts"] = [];

      for (const part of message.parts) {
        if (part.type === "file") {
          const clonedPart = await cloneFileUIPart(part);
          clonedParts.push(clonedPart);
        } else {
          clonedParts.push(part);
        }
      }

      const clonedMessage: T = {
        ...message,
        parts: clonedParts,
      };
      clonedMessages.push(clonedMessage);
    } else {
      clonedMessages.push(message);
    }
  }

  return clonedMessages;
}

export function cloneMessagesWithDocuments<
  TMessage extends {
    id: string;
    chatId: string;
    parentMessageId?: string | null;
    parts: any;
  },
  TDocument extends {
    id: string;
    messageId: string;
    userId: string;
    title: string;
    kind: any;
    content: string | null;
    createdAt: Date;
  },
>(
  sourceMessages: TMessage[],
  sourceDocuments: TDocument[],
  newChatId: string,
  newUserId: string
): {
  clonedMessages: TMessage[];
  clonedDocuments: TDocument[];
  messageIdMap: Map<string, string>;
  documentIdMap: Map<string, string>;
} {
  // Step 1: Clone messages using the existing cloneMessages function
  const clonedMessages = cloneMessages(sourceMessages, newChatId);

  // Step 2: Create message ID mapping for later use
  const messageIdMap = new Map<string, string>();
  for (let i = 0; i < sourceMessages.length; i++) {
    messageIdMap.set(sourceMessages[i].id, clonedMessages[i].id);
  }

  // Step 3: Create document ID mapping
  const documentIdMap = createDocumentIdMap(sourceDocuments);

  // Step 4: Update document references in message parts
  const messagesWithUpdatedDocRefs = updateDocumentReferencesInMessageParts(
    clonedMessages,
    documentIdMap
  );

  // Step 5: Clone documents
  const clonedDocuments = cloneDocuments(
    sourceDocuments,
    documentIdMap,
    messageIdMap,
    newUserId
  );

  return {
    clonedMessages: messagesWithUpdatedDocRefs,
    clonedDocuments,
    messageIdMap,
    documentIdMap,
  };
}
