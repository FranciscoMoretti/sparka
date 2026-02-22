import { TRPCError } from "@trpc/server";
import { generateText } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import type { ChatMessage } from "@/lib/ai/types";
import {
  cloneAttachmentsInMessages,
  cloneMessagesWithDocuments,
} from "@/lib/clone-messages";
import { config } from "@/lib/config";
import {
  deleteChatById,
  deleteMessagesByChatIdAfterMessageId,
  getAllMessagesByChatId,
  getChatById,
  getChatsByUserId,
  getDocumentsByMessageIds,
  getMessageById,
  saveChat,
  saveChatMessages,
  saveDocuments,
  updateChatIsPinnedById,
  updateChatTitleById,
  updateChatVisiblityById,
  updateMessageCanceledAt,
} from "@/lib/db/queries";
import { MAX_MESSAGE_CHARS } from "@/lib/limits/tokens";
import { dbChatToUIChat } from "@/lib/message-conversion";
import { generateUUID } from "@/lib/utils";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/trpc/init";

export const chatRouter = createTRPCRouter({
  getAllChats: protectedProcedure
    .input(
      z
        .object({
          projectId: z.uuid().optional().nullable(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      console.log("[getAllChats] Starting", {
        userId: ctx.user.id,
        projectId: input?.projectId,
        inputType: typeof input?.projectId,
      });

      try {
        const chats = await getChatsByUserId({
          id: ctx.user.id,
          projectId: input?.projectId,
        });

        console.log("[getAllChats] Retrieved chats from DB", {
          count: chats.length,
          sampleChat: chats[0]
            ? {
                id: chats[0].id,
                isPinned: chats[0].isPinned,
                updatedAt: chats[0].updatedAt,
                updatedAtType: typeof chats[0].updatedAt,
              }
            : null,
        });

        // Sort chats by pinned status, then by last updated date
        chats.sort((a, b) => {
          if (a.isPinned && !b.isPinned) {
            return -1;
          }
          if (!a.isPinned && b.isPinned) {
            return 1;
          }
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });

        console.log("[getAllChats] After sorting", { count: chats.length });

        const result = chats.map(dbChatToUIChat);
        console.log("[getAllChats] After mapping to UI", {
          count: result.length,
        });
        return result;
      } catch (error) {
        console.error("[getAllChats] Error:", error);
        throw error;
      }
    }),

  getChatById: protectedProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const chat = await getChatById({ id: input.chatId });

      if (!chat || chat.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }

      return dbChatToUIChat(chat);
    }),

  getChatMessages: protectedProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify the chat belongs to the user
      const chat = await getChatById({ id: input.chatId });
      if (!chat || chat.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found",
        });
      }

      const dbMessages = await getAllMessagesByChatId({ chatId: input.chatId });
      return dbMessages;
    }),

  renameChat: protectedProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        title: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the chat belongs to the user
      const chat = await getChatById({ id: input.chatId });
      if (!chat || chat.userId !== ctx.user.id) {
        throw new Error("Chat not found or access denied");
      }

      const _res = await updateChatTitleById({
        chatId: input.chatId,
        title: input.title,
      });
      return;
    }),

  deleteTrailingMessages: protectedProcedure
    .input(
      z.object({
        messageId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get the message to verify it exists and get its chat
      const [message] = await getMessageById({ id: input.messageId });

      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      }

      // Verify the chat belongs to the user
      const chat = await getChatById({ id: message.chatId });
      if (!chat || chat.userId !== ctx.user.id) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Access denied" });
      }

      // Delete all messages after the specified message (by position, not timestamp)
      await deleteMessagesByChatIdAfterMessageId({
        chatId: message.chatId,
        messageId: input.messageId,
      });

      return;
    }),

  stopStream: protectedProcedure
    .input(
      z.object({
        messageId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [msg] = await getMessageById({ id: input.messageId });
      if (!msg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      }

      const chat = await getChatById({ id: msg.chatId });
      if (!chat || chat.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found or access denied",
        });
      }

      await updateMessageCanceledAt({
        messageId: input.messageId,
        canceledAt: new Date(),
      });

      return { success: true };
    }),

  setVisibility: protectedProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        visibility: z.enum(["private", "public"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the chat belongs to the user
      const chat = await getChatById({ id: input.chatId });
      if (!chat || chat.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found or access denied",
        });
      }

      // Update chat visibility
      await updateChatVisiblityById({
        chatId: input.chatId,
        visibility: input.visibility,
      });

      return { success: true };
    }),

  setIsPinned: protectedProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        isPinned: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the chat belongs to the user
      const chat = await getChatById({ id: input.chatId });
      if (!chat || chat.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found or access denied",
        });
      }

      // Update chat isPinned
      await updateChatIsPinnedById({
        chatId: input.chatId,
        isPinned: input.isPinned,
      });

      return { success: true };
    }),

  deleteChat: protectedProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const chat = await getChatById({ id: input.chatId });
      if (!chat || chat.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat not found or access denied",
        });
      }

      await deleteChatById({ id: input.chatId });
      return { success: true };
    }),

  generateTitle: publicProcedure
    .input(
      z.object({
        message: z.string().min(1).max(MAX_MESSAGE_CHARS),
      })
    )
    .mutation(async ({ input }) => {
      const { text: title } = await generateText({
        model: await getLanguageModel(config.ai.workflows.title),
        system: `\n
        - you will generate a short title based on the first message a user begins a conversation with
        - ensure it is not more than 80 characters long
        - the title should be a summary of the user's message
        - do not use quotes or colons`,
        prompt: input.message,
        experimental_telemetry: { isEnabled: true },
      });

      return { title };
    }),

  getPublicChat: publicProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      const chat = await getChatById({ id: input.chatId });

      if (!chat || chat.visibility !== "public") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Public chat not found",
        });
      }

      return dbChatToUIChat(chat);
    }),

  getPublicChatMessages: publicProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      // First verify the chat is public
      const chat = await getChatById({ id: input.chatId });

      if (!chat || chat.visibility !== "public") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Public chat not found",
        });
      }

      const dbMessages = await getAllMessagesByChatId({ chatId: input.chatId });
      return dbMessages;
    }),

  cloneSharedChat: protectedProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First verify the chat is public
      const sourceChat = await getChatById({ id: input.chatId });

      if (!sourceChat || sourceChat.visibility !== "public") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Public chat not found",
        });
      }

      // Get all messages from the source chat
      const sourceMessages = await getAllMessagesByChatId({
        chatId: input.chatId,
      });

      if (sourceMessages.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Source chat has no messages to copy",
        });
      }

      // Get all documents associated with the source messages
      const sourceMessageIds = sourceMessages.map((msg) => msg.id);
      const sourceDocuments = await getDocumentsByMessageIds({
        messageIds: sourceMessageIds,
      });

      // Create a new chat for the user
      const newChatId = generateUUID();

      // Insert the new chat
      await saveChat({
        id: newChatId,
        userId: ctx.user.id,
        title: `${sourceChat.title}`,
      });

      // Clone messages and documents with updated IDs
      const { clonedMessages, clonedDocuments } = cloneMessagesWithDocuments(
        sourceMessages.map((msg) => ({
          ...msg,
          chatId: input.chatId,
        })) as Array<ChatMessage & { chatId: string }>,
        sourceDocuments,
        newChatId,
        ctx.user.id
      );

      // Clone attachments in messages (this has side effects - network calls to blob storage)
      const messagesWithClonedAttachments =
        await cloneAttachmentsInMessages(clonedMessages);

      // Save cloned messages first, then documents due to foreign key dependency
      await saveChatMessages({
        messages: messagesWithClonedAttachments.map((msg) => ({
          id: msg.id,
          chatId: newChatId,
          message: msg,
        })),
      });
      if (clonedDocuments.length > 0) {
        await saveDocuments({ documents: clonedDocuments });
      }

      return { chatId: newChatId };
    }),
});
