import type { YourUIMessage } from './types/ui';
import { generateUUID } from './utils';
import type { Attachment } from './ai/types';
import { uploadFile } from './blob';

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
          `Parent message ID ${message.parentMessageId} not found in mapping`,
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
  documents: T[],
): Map<string, string> {
  const documentIdMap = new Map<string, string>();
  for (const document of documents) {
    documentIdMap.set(document.id, generateUUID());
  }
  return documentIdMap;
}
function updateDocumentReferencesInMessageParts<T extends { parts: any }>(
  messages: T[],
  documentIdMap: Map<string, string>,
): T[] {
  return messages.map((message) => {
    const parts = message.parts as YourUIMessage['parts'];
    let updatedParts: YourUIMessage['parts'] = [];

    if (Array.isArray(parts)) {
      // TODO: Fix artifact constant not matching artifact kinds
      // @ts-expect-error: artifact constant not matching artifact kinds
      updatedParts = parts.map((part) => {
        if (
          part.type !== 'tool-invocation' ||
          part.toolInvocation.state !== 'result'
        ) {
          return part;
        }

        if (part.toolInvocation.toolName === 'deepResearch') {
          if (!part.toolInvocation.result.success) {
            return part;
          }
          if (part.toolInvocation.result.format === 'report') {
            const oldDocId = part.toolInvocation.result?.id;
            const newDocId = documentIdMap.get(oldDocId);
            if (newDocId) {
              return {
                ...part,
                toolInvocation: {
                  ...part.toolInvocation,
                  result: {
                    ...part.toolInvocation.result,
                    id: newDocId,
                  },
                },
              };
            } else {
              throw new Error(`Document ID ${oldDocId} not found in mapping`);
            }
          } else {
            return part;
          }
        } else if (
          part.toolInvocation.toolName === 'updateDocument' ||
          part.toolInvocation.toolName === 'createDocument'
        ) {
          if (!part.toolInvocation.result.success) {
            return part;
          }

          const oldDocId = part.toolInvocation.result.id;
          const newDocId = documentIdMap.get(oldDocId);
          if (newDocId) {
            return {
              ...part,
              toolInvocation: {
                ...part.toolInvocation,
                result: {
                  ...part.toolInvocation.result,
                  id: newDocId,
                },
              },
            };
          } else {
            throw new Error(`Document ID ${oldDocId} not found in mapping`);
          }
        }
        throw new Error(
          `Tool invocation ${part.toolInvocation?.toolName} not found in mapping`,
        );
      });
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
  newUserId: string,
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

export async function cloneAttachment(
  attachment: Attachment,
): Promise<Attachment> {
  try {
    // Skip if no URL is provided
    if (!attachment.url) {
      console.warn('Attachment has no URL, skipping clone');
      return attachment;
    }

    // Skip if URL is not a blob URL (might be external)
    if (!attachment.url.includes('blob.vercel-storage.com')) {
      console.warn(
        'Attachment is not a Vercel blob, skipping clone:',
        attachment.url,
      );
      return attachment;
    }

    // Fetch the original file
    const response = await fetch(attachment.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch attachment: ${response.statusText}`);
    }

    const blob = await response.blob();

    // Extract just the base filename without any path components
    let filename = attachment.name || 'attachment';

    // If filename contains path separators, get just the last part
    if (filename.includes('/')) {
      filename = filename.split('/').pop() || 'attachment';
    }

    // Remove any existing prefix if it somehow got into the filename
    if (filename.startsWith('sparka-ai/files/')) {
      filename = filename.replace('sparka-ai/files/', '');
    }

    const newBlob = await uploadFile(
      filename,
      Buffer.from(await blob.arrayBuffer()),
    );

    return {
      ...attachment,
      url: newBlob.url,
    };
  } catch (error) {
    console.error('Failed to clone attachment:', error);
    // Return original attachment as fallback to avoid breaking the cloning process
    return attachment;
  }
}

export async function cloneAttachmentsInMessages<
  T extends { attachments: any },
>(messages: T[]): Promise<T[]> {
  const clonedMessages: T[] = [];

  for (const message of messages) {
    if (message.attachments && Array.isArray(message.attachments)) {
      const attachments = message.attachments as Attachment[];
      const clonedAttachments: Attachment[] = [];

      for (const attachment of attachments) {
        const clonedAttachment = await cloneAttachment(attachment);
        clonedAttachments.push(clonedAttachment);
      }

      const clonedMessage: T = {
        ...message,
        attachments: clonedAttachments,
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
  newUserId: string,
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
    documentIdMap,
  );

  // Step 5: Clone documents
  const clonedDocuments = cloneDocuments(
    sourceDocuments,
    documentIdMap,
    messageIdMap,
    newUserId,
  );

  return {
    clonedMessages: messagesWithUpdatedDocRefs,
    clonedDocuments,
    messageIdMap,
    documentIdMap,
  };
}
