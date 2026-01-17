"use client";

// Hooks for chat data fetching and mutations
// For authenticated users only - anonymous users don't persist data

import {
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
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

// Query key for anonymous credits - allows invalidation after messages
export const ANONYMOUS_CREDITS_KEY = ["anonymousCredits"] as const;

function snapshotAllChatsQueries(
  qc: ReturnType<typeof useQueryClient>,
  key: QueryKey
) {
  return qc.getQueriesData<UIChat[]>({ queryKey: key });
}

function restoreAllChatsQueries(
  qc: ReturnType<typeof useQueryClient>,
  snapshot: [QueryKey, UIChat[] | undefined][]
) {
  for (const [k, data] of snapshot) {
    qc.setQueryData(k, data);
  }
}

function updateAllChatsQueries(
  qc: ReturnType<typeof useQueryClient>,
  key: QueryKey,
  updater: (old: UIChat[] | undefined) => UIChat[] | undefined
) {
  const entries = qc.getQueriesData<UIChat[]>({ queryKey: key });
  for (const [k] of entries) {
    qc.setQueryData<UIChat[] | undefined>(k, updater);
  }
}

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
  const allChatsKey = trpc.chat.getAllChats.queryKey();

  const deleteMutation = useMutation({
    mutationFn: trpc.chat.deleteChat.mutationOptions().mutationFn,
    onMutate: async ({
      chatId,
    }): Promise<{
      previousAllChats?: [QueryKey, UIChat[] | undefined][];
    }> => {
      if (!isAuthenticated) {
        return { previousAllChats: undefined };
      }
      const snapshot = snapshotAllChatsQueries(qc, allChatsKey);
      await qc.cancelQueries({ queryKey: allChatsKey, exact: false });
      updateAllChatsQueries(
        qc,
        allChatsKey,
        (old) => old?.filter((c) => c.id !== chatId) ?? old
      );
      return { previousAllChats: snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousAllChats) {
        restoreAllChatsQueries(qc, ctx.previousAllChats);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: allChatsKey, exact: false });
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
  const allChatsKey = trpc.chat.getAllChats.queryKey();

  return useMutation({
    mutationFn: trpc.chat.renameChat.mutationOptions().mutationFn,
    onMutate: async ({
      chatId,
      title,
    }): Promise<{
      previousAllChats?: [QueryKey, UIChat[] | undefined][];
      previousChatById?: UIChat | null;
    }> => {
      if (!isAuthenticated) {
        return { previousAllChats: undefined, previousChatById: undefined };
      }
      const byIdKey = trpc.chat.getChatById.queryKey({ chatId });

      await Promise.all([
        qc.cancelQueries({ queryKey: allChatsKey, exact: false }),
        qc.cancelQueries({ queryKey: byIdKey }),
      ]);

      const previousAllChats = snapshotAllChatsQueries(qc, allChatsKey);
      const previousChatById = qc.getQueryData<UIChat | null>(byIdKey);

      updateAllChatsQueries(
        qc,
        allChatsKey,
        (old) => old?.map((c) => (c.id === chatId ? { ...c, title } : c)) ?? old
      );
      if (previousChatById) {
        qc.setQueryData<UIChat | null>(byIdKey, { ...previousChatById, title });
      }

      return { previousAllChats, previousChatById };
    },
    onError: (_err, { chatId }, ctx) => {
      if (ctx?.previousAllChats) {
        restoreAllChatsQueries(qc, ctx.previousAllChats);
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
        qc.invalidateQueries({ queryKey: allChatsKey, exact: false }),
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
  const allChatsKey = trpc.chat.getAllChats.queryKey();

  return useMutation({
    mutationFn: trpc.chat.setIsPinned.mutationOptions().mutationFn,
    onMutate: async ({
      chatId,
      isPinned,
    }): Promise<{
      previousAllChats?: [QueryKey, UIChat[] | undefined][];
    }> => {
      if (!isAuthenticated) {
        return { previousAllChats: undefined };
      }
      const snapshot = snapshotAllChatsQueries(qc, allChatsKey);
      await qc.cancelQueries({ queryKey: allChatsKey, exact: false });
      updateAllChatsQueries(
        qc,
        allChatsKey,
        (old) =>
          old?.map((c) => (c.id === chatId ? { ...c, isPinned } : c)) ?? old
      );
      return { previousAllChats: snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousAllChats) {
        restoreAllChatsQueries(qc, ctx.previousAllChats);
      }
      toast.error("Failed to pin chat");
    },
    onSettled: async (_data, _error, { chatId }) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: allChatsKey, exact: false }),
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
  const allChatsKey = trpc.chat.getAllChats.queryKey();

  return useMutation({
    ...trpc.chat.cloneSharedChat.mutationOptions(),
    onSettled: () => qc.refetchQueries({ queryKey: allChatsKey, exact: false }),
    onError: (error) => console.error("Failed to copy chat:", error),
  });
}

export function useSaveMessageMutation() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const trpc = useTRPC();
  const qc = useQueryClient();

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
      if (message.role === "assistant") {
        if (isAuthenticated) {
          qc.invalidateQueries({
            queryKey: trpc.credits.getAvailableCredits.queryKey(),
          });
          await Promise.all([
            qc.invalidateQueries({
              queryKey: trpc.chat.getAllChats.queryKey(),
              exact: false,
            }),
            qc.invalidateQueries({
              queryKey: trpc.chat.getChatById.queryKey({ chatId }),
            }),
          ]);
        } else {
          // Refresh anonymous credits from cookie
          qc.invalidateQueries({ queryKey: ANONYMOUS_CREDITS_KEY });
        }
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
      qc.invalidateQueries({
        queryKey: trpc.chat.getAllChats.queryKey(),
        exact: false,
      }),
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

export function useGetAllChats(opts?: {
  projectId?: string | null;
  limit?: number;
}) {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const { projectId, limit } = opts ?? {};

  return useQuery({
    ...trpc.chat.getAllChats.queryOptions({
      projectId: projectId ?? null,
    }),
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

  // Use a query for anonymous credits so we can invalidate it
  const { data: anonymousCredits } = useQuery({
    queryKey: ANONYMOUS_CREDITS_KEY,
    queryFn: () => {
      const anonymousSession = getAnonymousSession();
      return anonymousSession?.remainingCredits ?? ANONYMOUS_LIMITS.CREDITS;
    },
    enabled: !isAuthenticated,
    staleTime: 0,
  });

  if (!isAuthenticated) {
    return {
      credits: anonymousCredits ?? ANONYMOUS_LIMITS.CREDITS,
      isLoadingCredits: false,
    };
  }

  return {
    credits: (creditsData as { totalCredits: number } | undefined)
      ?.totalCredits,
    isLoadingCredits,
  };
}
