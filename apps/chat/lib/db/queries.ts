import "server-only";
import { del } from "@vercel/blob";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  type SQL,
} from "drizzle-orm";
import type {
  Attachment,
  ChatMessage,
  ToolName,
  ToolOutput,
} from "@/lib/ai/types";
import { isSelectedModelValue } from "@/lib/ai/types";
import { createModuleLogger } from "@/lib/logger";
import { chatMessageToDbMessage } from "@/lib/message-conversion";

const logger = createModuleLogger("db:queries");

import {
  mapDBPartsToUIParts,
  mapUIMessagePartsToDBParts,
} from "@/lib/utils/message-mapping";
import type { ArtifactKind } from "../artifacts/artifact-kind";
import { db } from "./client";
import {
  chat,
  type DBMessage,
  document,
  message,
  type Part,
  part,
  project,
  suggestion,
  type User,
  type UserModelPreference,
  user,
  userModelPreference,
  vote,
} from "./schema";

async function _getUserByEmail(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    console.error("Failed to get user from database");
    throw error;
  }
}

export async function saveChat({
  id,
  userId,
  title,
  projectId,
}: {
  id: string;
  userId: string;
  title: string;
  projectId?: string;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId,
      title,
      projectId: projectId ?? null,
    });
  } catch (error) {
    console.error("Failed to save chat in database");
    throw error;
  }
}

export async function saveChatIfNotExists({
  id,
  userId,
  title,
  projectId,
}: {
  id: string;
  userId: string;
  title: string;
  projectId?: string;
}) {
  try {
    return await db
      .insert(chat)
      .values({
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId,
        title,
        projectId: projectId ?? null,
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error("Failed to save chat in database");
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    // Get all messages for this chat to clean up their attachments
    const messagesToDelete = await db
      .select()
      .from(message)
      .where(eq(message.chatId, id));

    // Clean up attachments before deleting the chat (which will cascade delete messages)
    if (messagesToDelete.length > 0) {
      await deleteAttachmentsFromMessages(messagesToDelete);
    }

    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error("Failed to delete chat by id from database");
    throw error;
  }
}

export async function getChatsByUserId({
  id,
  projectId,
}: {
  id: string;
  projectId?: string | null;
}) {
  console.log("[getChatsByUserId] Starting", {
    userId: id,
    projectId,
    projectIdType: typeof projectId,
    projectIdIsNull: projectId === null,
    projectIdIsUndefined: projectId === undefined,
  });

  try {
    let conditions: SQL<unknown> | undefined = eq(chat.userId, id);
    if (projectId === null) {
      // Filter for chats without a project
      conditions = and(eq(chat.userId, id), isNull(chat.projectId));
      console.log("[getChatsByUserId] Using null project condition");
    } else if (projectId) {
      // Filter for chats in a specific project
      conditions = and(eq(chat.userId, id), eq(chat.projectId, projectId));
      console.log("[getChatsByUserId] Using specific project condition", {
        projectId,
      });
    } else {
      // Get all chats for user
      conditions = eq(chat.userId, id);
      console.log("[getChatsByUserId] Using all chats condition");
    }

    console.log("[getChatsByUserId] Executing query");
    const result = await db
      .select()
      .from(chat)
      .where(conditions)
      .orderBy(desc(chat.updatedAt));

    console.log("[getChatsByUserId] Query completed", {
      count: result.length,
      sampleChat: result[0]
        ? {
            id: result[0].id,
            updatedAt: result[0].updatedAt,
            updatedAtType: typeof result[0].updatedAt,
          }
        : null,
    });

    return result;
  } catch (error) {
    console.error(
      "[getChatsByUserId] Failed to get chats by user from database",
      {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        userId: id,
        projectId,
      }
    );
    throw error;
  }
}

export async function createProject({
  id,
  userId,
  name,
  instructions = "",
  icon,
  iconColor,
}: {
  id: string;
  userId: string;
  name: string;
  instructions?: string;
  icon?: string;
  iconColor?: string;
}) {
  try {
    return await db.insert(project).values({
      id,
      userId,
      name,
      instructions,
      ...(icon && { icon }),
      ...(iconColor && { iconColor }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to create project in database");
    throw error;
  }
}

export async function getProjectsByUserId({ userId }: { userId: string }) {
  try {
    return await db
      .select()
      .from(project)
      .where(eq(project.userId, userId))
      .orderBy(desc(project.updatedAt));
  } catch (error) {
    console.error("Failed to get projects by user from database");
    throw error;
  }
}

export async function getProjectById({ id }: { id: string }) {
  try {
    const [selectedProject] = await db
      .select()
      .from(project)
      .where(eq(project.id, id));
    return selectedProject;
  } catch (error) {
    console.error("Failed to get project by id from database");
    throw error;
  }
}

export async function updateProject({
  id,
  updates,
}: {
  id: string;
  updates: Partial<{
    name: string;
    instructions: string;
    icon: string;
    iconColor: string;
  }>;
}) {
  try {
    return await db
      .update(project)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(project.id, id));
  } catch (error) {
    console.error("Failed to update project in database");
    throw error;
  }
}

export async function deleteProject({ id }: { id: string }) {
  try {
    return await db.delete(project).where(eq(project.id, id));
  } catch (error) {
    console.error("Failed to delete project from database");
    throw error;
  }
}

async function _getChatsByProjectId({ projectId }: { projectId: string }) {
  try {
    return await db
      .select()
      .from(chat)
      .where(eq(chat.projectId, projectId))
      .orderBy(desc(chat.updatedAt));
  } catch (error) {
    console.error("Failed to get chats by project id from database");
    throw error;
  }
}

async function _moveChatToProject({
  chatId,
  projectId,
}: {
  chatId: string;
  projectId: string | null;
}) {
  try {
    return await db.update(chat).set({ projectId }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error("Failed to move chat to project in database");
    throw error;
  }
}

async function _tryGetChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (_error) {
    return null;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    console.error("Failed to get chat by id from database");
    throw error;
  }
}

export async function saveMessage({
  id,
  chatId,
  message: chatMessage,
}: {
  id: string;
  chatId: string;
  message: ChatMessage;
}) {
  try {
    return await db.transaction(async (tx) => {
      // Convert ChatMessage to DBMessage (without parts)
      const dbMessage = chatMessageToDbMessage(chatMessage, chatId);
      dbMessage.id = id;

      // Insert message (without parts - parts are stored in Part table)
      await tx.insert(message).values(dbMessage);

      // Save parts to Part table
      const mappedDBParts = mapUIMessagePartsToDBParts(chatMessage.parts, id);
      if (mappedDBParts.length > 0) {
        await tx.insert(part).values(mappedDBParts);
      }

      // Update chat's updatedAt timestamp
      await updateChatUpdatedAt({ chatId });

      return;
    });
  } catch (error) {
    logger.error({ error, chatId, id }, "saveMessage failed");
    throw error;
  }
}

export async function saveMessageIfNotExists({
  id,
  chatId,
  message: chatMessage,
}: {
  id: string;
  chatId: string;
  message: ChatMessage;
}) {
  try {
    return await db.transaction(async (tx) => {
      const dbMessage = chatMessageToDbMessage(chatMessage, chatId);
      dbMessage.id = id;

      const insertedMessages = await tx
        .insert(message)
        .values(dbMessage)
        .onConflictDoNothing()
        .returning({ id: message.id });

      if (insertedMessages.length === 0) {
        return;
      }

      const mappedDBParts = mapUIMessagePartsToDBParts(chatMessage.parts, id);
      if (mappedDBParts.length > 0) {
        await tx.insert(part).values(mappedDBParts);
      }

      await updateChatUpdatedAt({ chatId });
    });
  } catch (error) {
    logger.error({ error, chatId, id }, "saveMessageIfNotExists failed");
    throw error;
  }
}

export async function saveChatMessages({
  messages,
}: {
  messages: Array<{
    id: string;
    chatId: string;
    message: ChatMessage;
  }>;
}) {
  try {
    if (messages.length === 0) {
      return;
    }
    return await db.transaction(async (tx) => {
      // Insert messages (without parts - parts are stored in Part table)
      const dbMessages = messages.map(({ id, chatId, message: msg }) => {
        const dbMsg = chatMessageToDbMessage(msg, chatId);
        dbMsg.id = id;
        return dbMsg;
      });
      await tx.insert(message).values(dbMessages);

      // Save parts to Part table
      const allDbParts: Omit<Part, "id" | "createdAt">[] = [];
      for (const { id, message: msg } of messages) {
        const dbParts = mapUIMessagePartsToDBParts(msg.parts, id);
        allDbParts.push(...dbParts);
      }
      if (allDbParts.length > 0) {
        await tx.insert(part).values(allDbParts);
      }

      // Update chat's updatedAt timestamp for all affected chats
      const uniqueChatIds = [...new Set(messages.map(({ chatId }) => chatId))];
      await Promise.all(
        uniqueChatIds.map((chatId) => updateChatUpdatedAt({ chatId }))
      );

      return;
    });
  } catch (error) {
    logger.error(
      { error, messageIds: messages.map((m) => m.id) },
      "saveChatMessages failed"
    );
    throw error;
  }
}

export async function updateMessage({
  id,
  chatId,
  message: chatMessage,
}: {
  id: string;
  chatId: string;
  message: ChatMessage;
}) {
  try {
    return await db.transaction(async (tx) => {
      // Convert ChatMessage to DBMessage (without parts)
      const dbMessage = chatMessageToDbMessage(chatMessage, chatId);
      dbMessage.id = id;

      // Update message (without parts - parts are stored in Part table)
      await tx
        .update(message)
        .set({
          annotations: dbMessage.annotations,
          attachments: dbMessage.attachments,
          createdAt: dbMessage.createdAt,
          parentMessageId: dbMessage.parentMessageId,
          selectedModel: dbMessage.selectedModel,
          selectedTool: dbMessage.selectedTool,
          parallelGroupId: dbMessage.parallelGroupId,
          parallelIndex: dbMessage.parallelIndex,
          isPrimaryParallel: dbMessage.isPrimaryParallel,
          lastContext: dbMessage.lastContext,
          activeStreamId: dbMessage.activeStreamId,
        })
        .where(eq(message.id, id));

      // Update parts in Part table
      // Delete existing parts
      await tx.delete(part).where(eq(part.messageId, id));

      // Insert new parts
      const mappedDBParts = mapUIMessagePartsToDBParts(chatMessage.parts, id);
      if (mappedDBParts.length > 0) {
        await tx.insert(part).values(mappedDBParts);
      }

      return;
    });
  } catch (error) {
    logger.error({ error, messageId: id, chatId }, "updateMessage failed");
    throw error;
  }
}

export function updateMessageActiveStreamId({
  id,
  activeStreamId,
}: {
  id: string;
  activeStreamId: string | null;
}) {
  return db.update(message).set({ activeStreamId }).where(eq(message.id, id));
}

export async function getAllMessagesByChatId({
  chatId,
}: {
  chatId: string;
}): Promise<ChatMessage[]> {
  try {
    const messages = await db
      .select()
      .from(message)
      .where(eq(message.chatId, chatId))
      .orderBy(asc(message.createdAt));

    if (messages.length === 0) {
      return [];
    }

    // Load all parts for all messages in a single query
    const messageIds = messages.map((msg) => msg.id);
    const allParts = await db
      .select()
      .from(part)
      .where(inArray(part.messageId, messageIds))
      .orderBy(asc(part.messageId), asc(part.order));

    // Group parts by messageId
    const partsByMessageId = new Map<string, Part[]>();
    for (const dbPart of allParts) {
      const existing = partsByMessageId.get(dbPart.messageId) ?? [];
      existing.push(dbPart);
      partsByMessageId.set(dbPart.messageId, existing);
    }

    // Reconstruct ChatMessage objects with parts from Part table
    return messages.map((msg) => {
      const dbParts = partsByMessageId.get(msg.id);
      const parts =
        dbParts && dbParts.length > 0 ? mapDBPartsToUIParts(dbParts) : [];

      return {
        id: msg.id,
        role: msg.role as ChatMessage["role"],
        parts,
        metadata: {
          createdAt: msg.createdAt,
          activeStreamId: msg.activeStreamId,
          parentMessageId: msg.parentMessageId,
          parallelGroupId: msg.parallelGroupId,
          parallelIndex: msg.parallelIndex,
          isPrimaryParallel: msg.isPrimaryParallel,
          selectedModel: isSelectedModelValue(msg.selectedModel)
            ? msg.selectedModel
            : ("" as ChatMessage["metadata"]["selectedModel"]),
          selectedTool: (msg.selectedTool ||
            undefined) as ChatMessage["metadata"]["selectedTool"],
          usage: msg.lastContext as ChatMessage["metadata"]["usage"],
        },
      };
    });
  } catch (error) {
    console.error("Failed to get all messages by chat ID", error);
    throw error;
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (error) {
    console.error("Failed to upvote message in database", error);
    throw error;
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    console.error("Failed to get votes by chat id from database", error);
    throw error;
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
  messageId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
  messageId: string;
}) {
  try {
    return await db.insert(document).values({
      id,
      title,
      kind,
      content,
      userId,
      messageId,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to save document in database", error);
    throw error;
  }
}

async function _getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    console.error("Failed to get document by id from database", error);
    throw error;
  }
}

export async function getDocumentsById({
  id,
  userId,
}: {
  id: string;
  userId?: string;
}) {
  try {
    // First, get the document and check ownership
    const documents = await _getDocumentsById({ id });

    if (documents.length === 0) {
      return [];
    }

    const [doc] = documents;

    if (!userId || doc.userId !== userId) {
      // Need to check if chat is public
      const documentsWithVisibility = await db
        .select({
          id: document.id,
          createdAt: document.createdAt,
          title: document.title,
          content: document.content,
          kind: document.kind,
          userId: document.userId,
          messageId: document.messageId,
          chatVisibility: chat.visibility,
        })
        .from(document)
        .innerJoin(message, eq(document.messageId, message.id))
        .innerJoin(chat, eq(message.chatId, chat.id))
        .where(and(eq(document.id, id), eq(chat.visibility, "public")))
        .orderBy(asc(document.createdAt));

      return documentsWithVisibility;
    }

    return documents;
  } catch (error) {
    console.error(
      "Failed to get documents by id with visibility from database"
    );
    throw error;
  }
}

export async function getPublicDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select({
        id: document.id,
        createdAt: document.createdAt,
        title: document.title,
        content: document.content,
        kind: document.kind,
        userId: document.userId,
        messageId: document.messageId,
      })
      .from(document)
      .innerJoin(message, eq(document.messageId, message.id))
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(and(eq(document.id, id), eq(chat.visibility, "public")))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    console.error("Failed to get public documents by id from database");
    throw error;
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    console.error("Failed to get document by id from database");
    throw error;
  }
}

async function _deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)));
  } catch (error) {
    console.error(
      "Failed to delete documents by id after timestamp from database"
    );
    throw error;
  }
}

export async function getDocumentsByMessageIds({
  messageIds,
}: {
  messageIds: string[];
}) {
  if (messageIds.length === 0) {
    return [];
  }

  try {
    return await db
      .select()
      .from(document)
      .where(inArray(document.messageId, messageIds))
      .orderBy(asc(document.createdAt));
  } catch (error) {
    console.error("Failed to get documents by message IDs from database");
    throw error;
  }
}

export async function saveDocuments({
  documents,
}: {
  documents: Array<{
    id: string;
    title: string;
    kind: ArtifactKind;
    content: string | null;
    userId: string;
    messageId: string;
    createdAt: Date;
  }>;
}) {
  if (documents.length === 0) {
    return;
  }

  try {
    return await db.insert(document).values(documents);
  } catch (error) {
    console.error("Failed to save documents in database", error);
    throw error;
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    logger.error({ error, messageId: id }, "getMessageById failed");
    throw error;
  }
}

export async function getChatMessageWithPartsById({
  id,
}: {
  id: string;
}): Promise<{
  chatId: string;
  message: ChatMessage;
} | null> {
  try {
    const [dbMessage] = await db
      .select()
      .from(message)
      .where(eq(message.id, id));
    if (!dbMessage) {
      return null;
    }

    const dbParts = await db
      .select()
      .from(part)
      .where(eq(part.messageId, id))
      .orderBy(asc(part.order));

    return {
      chatId: dbMessage.chatId,
      message: {
        id: dbMessage.id,
        role: dbMessage.role as ChatMessage["role"],
        parts: dbParts.length > 0 ? mapDBPartsToUIParts(dbParts) : [],
        metadata: {
          createdAt: dbMessage.createdAt,
          activeStreamId: dbMessage.activeStreamId,
          parentMessageId: dbMessage.parentMessageId,
          parallelGroupId: dbMessage.parallelGroupId,
          parallelIndex: dbMessage.parallelIndex,
          isPrimaryParallel: dbMessage.isPrimaryParallel,
          selectedModel: isSelectedModelValue(dbMessage.selectedModel)
            ? dbMessage.selectedModel
            : ("" as ChatMessage["metadata"]["selectedModel"]),
          selectedTool: (dbMessage.selectedTool ||
            undefined) as ChatMessage["metadata"]["selectedTool"],
          usage: dbMessage.lastContext as ChatMessage["metadata"]["usage"],
        },
      },
    };
  } catch (error) {
    logger.error(
      { error, messageId: id },
      "getChatMessageWithPartsById failed"
    );
    throw error;
  }
}

async function _deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select()
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map((msg) => msg.id);

    if (messageIds.length > 0) {
      // Clean up attachments before deleting messages
      await deleteAttachmentsFromMessages(messagesToDelete);

      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (error) {
    console.error(
      "Failed to delete messages by id after timestamp from database"
    );
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterMessageId({
  chatId,
  messageId,
}: {
  chatId: string;
  messageId: string;
}) {
  try {
    // First, get the target message to find its position in the chat
    const [targetMessage] = await db
      .select()
      .from(message)
      .where(and(eq(message.id, messageId), eq(message.chatId, chatId)));

    if (!targetMessage) {
      throw new Error("Target message not found");
    }

    // Get all messages in the chat ordered by creation time
    const allMessages = await db
      .select()
      .from(message)
      .where(eq(message.chatId, chatId))
      .orderBy(asc(message.createdAt));

    // Find the index of the target message
    const targetIndex = allMessages.findIndex((msg) => msg.id === messageId);

    if (targetIndex === -1) {
      throw new Error("Target message not found in chat");
    }

    // Delete all messages after the target message (including the target itself)
    const messagesToDelete = allMessages.slice(targetIndex);
    const messageIdsToDelete = messagesToDelete.map((msg) => msg.id);

    if (messageIdsToDelete.length > 0) {
      // Clean up attachments before deleting messages
      await deleteAttachmentsFromMessages(messagesToDelete);

      // Delete the messages (votes will be deleted automatically via CASCADE)
      return await db
        .delete(message)
        .where(
          and(
            eq(message.chatId, chatId),
            inArray(message.id, messageIdsToDelete)
          )
        );
    }
  } catch (error) {
    console.error(
      "Failed to delete messages by chat id after message id from database"
    );
    throw error;
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error("Failed to update chat visibility in database");
    throw error;
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await db
      .update(chat)
      .set({
        title,
      })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.error("Failed to update chat title by id from database");
    throw error;
  }
}

export async function updateChatIsPinnedById({
  chatId,
  isPinned,
}: {
  chatId: string;
  isPinned: boolean;
}) {
  try {
    return await db
      .update(chat)
      .set({
        isPinned,
      })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.error("Failed to update chat isPinned by id from database");
    throw error;
  }
}

export async function getMessageCanceledAt({
  messageId,
}: {
  messageId: string;
}): Promise<Date | null> {
  try {
    const [result] = await db
      .select({ canceledAt: message.canceledAt })
      .from(message)
      .where(eq(message.id, messageId));
    return result?.canceledAt ?? null;
  } catch (error) {
    logger.error({ error, messageId }, "getMessageCanceledAt failed");
    throw error;
  }
}

export async function updateMessageCanceledAt({
  messageId,
  canceledAt,
}: {
  messageId: string;
  canceledAt: Date | null;
}) {
  try {
    return await db
      .update(message)
      .set({ canceledAt })
      .where(eq(message.id, messageId));
  } catch (error) {
    logger.error({ error, messageId }, "updateMessageCanceledAt failed");
    throw error;
  }
}

async function updateChatUpdatedAt({ chatId }: { chatId: string }) {
  try {
    return await db
      .update(chat)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.error("Failed to update chat updatedAt by id from database");
    throw error;
  }
}

export async function getUserById({
  userId,
}: {
  userId: string;
}): Promise<User | undefined> {
  const users = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return users[0];
}

async function getMessagesWithAttachments() {
  try {
    return await db.select({ attachments: message.attachments }).from(message);
  } catch (error) {
    console.error(
      "Failed to get messages with attachments from database",
      error
    );
    throw error;
  }
}

function getGeneratedImageParts() {
  const toolName: ToolName = "generateImage";
  return db
    .select({ tool_output: part.tool_output })
    .from(part)
    .where(eq(part.tool_name, toolName));
}

function getFilePartUrls(args: { messageIds?: string[] } = {}) {
  const { messageIds } = args;
  let conditions: SQL<unknown> | undefined = eq(part.type, "file");
  if (messageIds && messageIds.length > 0) {
    conditions = and(conditions, inArray(part.messageId, messageIds));
  }
  return db.select({ file_url: part.file_url }).from(part).where(conditions);
}

function collectMessageAttachmentUrls(
  messages: { attachments: unknown }[]
): string[] {
  const urls: string[] = [];
  for (const msg of messages) {
    if (msg.attachments && Array.isArray(msg.attachments)) {
      for (const attachment of msg.attachments as Attachment[]) {
        if (attachment.url) {
          urls.push(attachment.url);
        }
      }
    }
  }
  return urls;
}

function collectFilePartUrls(
  fileParts: { file_url: string | null }[]
): string[] {
  const urls: string[] = [];
  for (const p of fileParts) {
    if (p.file_url) {
      urls.push(p.file_url);
    }
  }
  return urls;
}

export async function getAllAttachmentUrls(): Promise<string[]> {
  try {
    const [messages, generatedImageParts, fileParts] = await Promise.all([
      getMessagesWithAttachments(),
      getGeneratedImageParts(),
      getFilePartUrls(),
    ]);

    const attachmentUrls = [
      ...collectMessageAttachmentUrls(messages),
      ...collectFilePartUrls(fileParts),
    ];

    // Collect URLs from generated images in tool outputs
    for (const p of generatedImageParts) {
      const output = p.tool_output as ToolOutput<"generateImage"> | null;
      if (output?.imageUrl) {
        attachmentUrls.push(output.imageUrl);
      }
    }

    return [...new Set(attachmentUrls)];
  } catch (error) {
    console.error("Failed to get attachment URLs from database", error);
    throw error;
  }
}

async function deleteAttachmentsFromMessages(messages: DBMessage[]) {
  try {
    const attachmentUrls = collectMessageAttachmentUrls(messages);

    // Collect file URLs from Part table for these messages via shared helper
    const messageIds = messages.map((msg) => msg.id);
    if (messageIds.length > 0) {
      const fileParts = await getFilePartUrls({ messageIds });
      attachmentUrls.push(...collectFilePartUrls(fileParts));
    }

    // Deduplicate in case the same file URL is referenced multiple times
    const uniqueUrls = [...new Set(attachmentUrls)];
    if (uniqueUrls.length > 0) {
      await del(uniqueUrls);
    }
  } catch (error) {
    console.error("Failed to delete attachments from Vercel Blob:", error);
    // Don't throw here - we still want to proceed with message deletion
    // even if blob cleanup fails
  }
}

export async function getUserModelPreferences({
  userId,
}: {
  userId: string;
}): Promise<UserModelPreference[]> {
  try {
    return await db
      .select()
      .from(userModelPreference)
      .where(eq(userModelPreference.userId, userId));
  } catch (error) {
    console.error("Failed to get user model preferences from database", error);
    throw error;
  }
}

export async function upsertUserModelPreference({
  userId,
  modelId,
  enabled,
}: {
  userId: string;
  modelId: string;
  enabled: boolean;
}): Promise<void> {
  try {
    await db
      .insert(userModelPreference)
      .values({
        userId,
        modelId,
        enabled,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userModelPreference.userId, userModelPreference.modelId],
        set: {
          enabled,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error("Failed to upsert user model preference in database", error);
    throw error;
  }
}
