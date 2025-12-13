"use client";

// Hooks for chat data fetching and mutations
// For authenticated users only - anonymous users don't persist data

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useIsSharedRoute } from "@/hooks/use-is-shared-route";
import type { ChatMessage } from "@/lib/ai/types";
import { getAnonymousSession } from "@/lib/anonymous-session-client";
import type { Document, Project } from "@/lib/db/schema";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import type { UIChat } from "@/lib/types/ui-chat";
import { useChatId } from "@/providers/chat-id-provider";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

export function useProject(
  projectId: string | null,
  { enabled }: { enabled?: boolean } = {}
) {
  const trpc = useTRPC();
  const { data: session } = useSession();

  return useQuery({
    ...trpc.project.getById.queryOptions({
      id: projectId ?? "",
    }),
    enabled: (enabled ?? true) && !!session?.user && !!projectId,
  });
}

export function useGetChatMessagesQueryOptions() {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const { id: chatId, isPersisted } = useChatId();
  const isShared = useIsSharedRoute();

  return {
    ...trpc.chat.getChatMessages.queryOptions({ chatId: chatId || "" }),
    enabled: !!chatId && isPersisted && (isShared || !!session?.user),
  };
}

export function useMessagesQuery() {
  return useGetChatMessagesQueryOptions();
}

export function useDeleteChat() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const trpc = useTRPC();
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: trpc.chat.deleteChat.mutationOptions().mutationFn,
    onMutate: async ({ chatId }): Promise<{ previousChats?: UIChat[] }> => {
      if (!isAuthenticated) {
        return { previousChats: undefined };
      }
      const key = trpc.chat.getAllChats.queryKey();
      await qc.cancelQueries({ queryKey: key });
      const previousChats = qc.getQueryData<UIChat[]>(key);
      qc.setQueryData<UIChat[]>(
        key,
        (old) => old?.filter((c) => c.id !== chatId) ?? old
      );
      return { previousChats };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousChats) {
        qc.setQueryData(trpc.chat.getAllChats.queryKey(), ctx.previousChats);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: trpc.chat.getAllChats.queryKey() });
    },
  });

  const deleteChat = useCallback(
    async (
      chatId: string,
      options?: { onSuccess?: () => void; onError?: (error: Error) => void }
    ) => {
      if (!isAuthenticated) {
        return;
      }
      try {
        await deleteMutation.mutateAsync({ chatId });
        options?.onSuccess?.();
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        options?.onError?.(err);
        throw err;
      }
    },
    [deleteMutation, isAuthenticated]
  );

  return { deleteChat };
}

export function useRenameChat() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const qc = useQueryClient();
  const trpc = useTRPC();

  return useMutation({
    mutationFn: trpc.chat.renameChat.mutationOptions().mutationFn,
    onMutate: async ({
      chatId,
      title,
    }): Promise<{
      previousChats?: UIChat[];
      previousChatById?: UIChat | null;
    }> => {
      if (!isAuthenticated) {
        return { previousChats: undefined, previousChatById: undefined };
      }
      const allKey = trpc.chat.getAllChats.queryKey();
      const byIdKey = trpc.chat.getChatById.queryKey({ chatId });

      await Promise.all([
        qc.cancelQueries({ queryKey: allKey }),
        qc.cancelQueries({ queryKey: byIdKey }),
      ]);

      const previousChats = qc.getQueryData<UIChat[]>(allKey);
      const previousChatById = qc.getQueryData<UIChat | null>(byIdKey);

      qc.setQueryData<UIChat[] | undefined>(allKey, (old) =>
        old?.map((c) => (c.id === chatId ? { ...c, title } : c))
      );
      if (previousChatById) {
        qc.setQueryData<UIChat | null>(byIdKey, { ...previousChatById, title });
      }

      return { previousChats, previousChatById };
    },
    onError: (_err, { chatId }, ctx) => {
      if (ctx?.previousChats) {
        qc.setQueryData(trpc.chat.getAllChats.queryKey(), ctx.previousChats);
      }
      if (ctx?.previousChatById !== undefined) {
        qc.setQueryData(
          trpc.chat.getChatById.queryKey({ chatId }),
          ctx.previousChatById ?? undefined
        );
      }
      toast.error("Failed to rename chat");
    },
    onSettled: async (_data, _error, { chatId }) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: trpc.chat.getAllChats.queryKey() }),
        qc.invalidateQueries({
          queryKey: trpc.chat.getChatById.queryKey({ chatId }),
        }),
      ]);
    },
  });
}

export function useRenameProject() {
  const qc = useQueryClient();
  const trpc = useTRPC();

  return useMutation({
    ...trpc.project.update.mutationOptions(),
    onMutate: async (variables) => {
      const listKey = trpc.project.list.queryKey();
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<Project[]>(listKey);
      const nextName =
        typeof variables.updates.name === "string"
          ? variables.updates.name
          : undefined;
      if (nextName) {
        qc.setQueryData<Project[] | undefined>(listKey, (old) =>
          old?.map((p) =>
            p.id === variables.id ? { ...p, name: nextName } : p
          )
        );
      }
      return { previous };
    },
    onError: (_error, _variables, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(trpc.project.list.queryKey(), ctx.previous);
      }
      toast.error("Failed to rename project");
    },
    onSuccess: () => toast.success("Project renamed"),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: trpc.project.list.queryKey() }),
  });
}

export function usePinChat() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const trpc = useTRPC();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: trpc.chat.setIsPinned.mutationOptions().mutationFn,
    onMutate: async ({
      chatId,
      isPinned,
    }): Promise<{ previousChats?: UIChat[] }> => {
      if (!isAuthenticated) {
        return { previousChats: undefined };
      }
      const key = trpc.chat.getAllChats.queryKey();
      await qc.cancelQueries({ queryKey: key });
      const previousChats = qc.getQueryData<UIChat[]>(key);
      qc.setQueryData<UIChat[]>(key, (old) =>
        old?.map((c) => (c.id === chatId ? { ...c, isPinned } : c))
      );
      return { previousChats };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousChats) {
        qc.setQueryData(trpc.chat.getAllChats.queryKey(), ctx.previousChats);
      }
      toast.error("Failed to pin chat");
    },
    onSettled: async (_data, _error, { chatId }) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: trpc.chat.getAllChats.queryKey() }),
        qc.invalidateQueries({
          queryKey: trpc.chat.getChatById.queryKey({ chatId }),
        }),
      ]);
    },
  });
}

export function useDeleteTrailingMessages() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const trpc = useTRPC();
  const qc = useQueryClient();
  const trpcMutation = trpc.chat.deleteTrailingMessages.mutationOptions();

  // Wrap tRPC mutation to include chatId for cache management
  return useMutation({
    mutationFn: ({ messageId }: { messageId: string; chatId: string }) => {
      if (!trpcMutation.mutationFn) {
        throw new Error("deleteTrailingMessages mutation not available");
      }
      return trpcMutation.mutationFn({ messageId });
    },
    onMutate: async ({
      messageId,
      chatId,
    }): Promise<{ previousMessages?: ChatMessage[]; chatId: string }> => {
      if (!isAuthenticated) {
        return { previousMessages: undefined, chatId };
      }
      const key = trpc.chat.getChatMessages.queryKey({ chatId });
      await qc.cancelQueries({ queryKey: key });
      const previousMessages = qc.getQueryData<ChatMessage[]>(key);
      qc.setQueryData<ChatMessage[] | undefined>(key, (old) => {
        if (!old) {
          return old;
        }
        const idx = old.findIndex((msg) => msg.id === messageId);
        return idx === -1 ? old : old.slice(0, idx);
      });
      return { previousMessages, chatId };
    },
    onError: (_err, { chatId }, ctx) => {
      if (ctx?.previousMessages) {
        qc.setQueryData(
          trpc.chat.getChatMessages.queryKey({ chatId }),
          ctx.previousMessages
        );
      }
      toast.error("Failed to delete messages");
    },
    onSuccess: (_data, { chatId }) => {
      qc.invalidateQueries({
        queryKey: trpc.chat.getChatMessages.queryKey({ chatId }),
      });
      toast.success("Messages deleted");
    },
  });
}

export function useCloneChat() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  return useMutation({
    ...trpc.chat.cloneSharedChat.mutationOptions(),
    onSettled: () =>
      qc.refetchQueries({ queryKey: trpc.chat.getAllChats.queryKey() }),
    onError: (error) => console.error("Failed to copy chat:", error),
  });
}

export function useSaveMessageMutation() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const trpc = useTRPC();
  const qc = useQueryClient();

  const { confirmChatId } = useChatId();
  return useMutation({
    // Message is saved in the backend by another route. This doesn't need to actually mutate
    mutationFn: (_: { message: ChatMessage; chatId: string }) =>
      Promise.resolve({ success: true } as const),
    onMutate: async ({ message, chatId }) => {
      const key = trpc.chat.getChatMessages.queryKey({ chatId });
      await qc.cancelQueries({ queryKey: key });
      const previousMessages = qc.getQueryData<ChatMessage[]>(key);
      qc.setQueryData<ChatMessage[]>(key, (old) =>
        old ? [...old, message] : [message]
      );
      return { previousMessages, chatId };
    },
    onSuccess: async (_data, { message, chatId }) => {
      if (isAuthenticated && message.role === "assistant") {
        // TODO: Move this to the data-stream-handler (earlier) once the query cache is independent of message
        confirmChatId(chatId);
        qc.invalidateQueries({
          queryKey: trpc.credits.getAvailableCredits.queryKey(),
        });
        await Promise.all([
          qc.invalidateQueries({ queryKey: trpc.chat.getAllChats.queryKey() }),
          qc.invalidateQueries({
            queryKey: trpc.chat.getChatById.queryKey({ chatId }),
          }),
        ]);
      }
    },
  });
}

export function useSetVisibility() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  return useMutation({
    ...trpc.chat.setVisibility.mutationOptions(),
    onError: () => toast.error("Failed to update chat visibility"),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: trpc.chat.getAllChats.queryKey() }),
    onSuccess: (_data, { visibility }) => {
      toast.success(
        visibility === "public"
          ? "Chat is now public - anyone with the link can access it"
          : "Chat is now private - only you can access it"
      );
    },
  });
}

export function useSaveDocument(
  _documentId: string,
  messageId: string,
  options?: {
    onSettled?: (result: unknown, error: unknown, params: unknown) => void;
  }
) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  return useMutation({
    mutationFn: trpc.document.saveDocument.mutationOptions().mutationFn,
    onMutate: async (newDoc): Promise<{ previousDocuments: Document[] }> => {
      const key = trpc.document.getDocuments.queryKey({ id: newDoc.id });
      await qc.cancelQueries({ queryKey: key });
      const previousDocuments = qc.getQueryData<Document[]>(key) ?? [];
      qc.setQueryData(key, [
        ...previousDocuments,
        {
          id: newDoc.id,
          createdAt: new Date(),
          title: newDoc.title,
          content: newDoc.content,
          kind: newDoc.kind,
          userId: userId || "",
          messageId,
        } as Document,
      ]);
      return { previousDocuments };
    },
    onError: (_err, newDoc, ctx) => {
      if (ctx?.previousDocuments) {
        qc.setQueryData(
          trpc.document.getDocuments.queryKey({ id: newDoc.id }),
          ctx.previousDocuments
        );
      }
    },
    onSettled: (result, error, params) => {
      qc.invalidateQueries({
        queryKey: trpc.document.getDocuments.queryKey({ id: params.id }),
      });
      options?.onSettled?.(result, error, params);
    },
  });
}

export function useDocuments(id: string, disable: boolean) {
  const trpc = useTRPC();
  const isShared = useIsSharedRoute();
  const { data: session } = useSession();

  return useQuery({
    ...(isShared
      ? trpc.document.getPublicDocuments.queryOptions({ id })
      : trpc.document.getDocuments.queryOptions({ id })),
    enabled: !disable && !!id && (isShared || !!session?.user),
  });
}

export function useGetAllChats(limit?: number) {
  const { data: session } = useSession();
  const trpc = useTRPC();

  return useQuery({
    ...trpc.chat.getAllChats.queryOptions(),
    enabled: !!session?.user,
    select: limit ? (data: UIChat[]) => data.slice(0, limit) : undefined,
  });
}

export function useGetChatByIdQueryOptions(chatId: string) {
  const { data: session } = useSession();
  const trpc = useTRPC();

  return {
    ...trpc.chat.getChatById.queryOptions({ chatId }),
    enabled: !!chatId && !!session?.user,
  };
}

export function useGetChatById(
  chatId: string,
  { enabled }: { enabled?: boolean } = {}
) {
  const options = useGetChatByIdQueryOptions(chatId);
  return useQuery({
    ...options,
    enabled: (enabled ?? true) && (options.enabled ?? true),
  });
}

export function useGetCredits() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const trpc = useTRPC();

  const { data: creditsData, isLoading: isLoadingCredits } = useQuery({
    ...trpc.credits.getAvailableCredits.queryOptions(),
    enabled: isAuthenticated,
  });

  const [anonymousCredits, setAnonymousCredits] = useState<number>(
    ANONYMOUS_LIMITS.CREDITS
  );

  useEffect(() => {
    if (!isAuthenticated) {
      const anonymousSession = getAnonymousSession();
      setAnonymousCredits(
        anonymousSession?.remainingCredits ?? ANONYMOUS_LIMITS.CREDITS
      );
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return {
      credits: anonymousCredits,
      isLoadingCredits: false,
    };
  }

  return {
    credits: (creditsData as { totalCredits: number } | undefined)
      ?.totalCredits,
    isLoadingCredits,
  };
}
