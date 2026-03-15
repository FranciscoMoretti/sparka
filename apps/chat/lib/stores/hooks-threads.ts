// Hooks enabled by the with-threads middleware

import { useCallback } from "react";
import { useStoreWithEqualityFn } from "zustand/traditional";
import type { ChatMessage } from "../ai/types";
import {
  type CustomChatStoreState,
  useCustomChatStoreApi,
} from "./custom-store-provider";
import type { MessageSiblingInfo, ParallelGroupInfo } from "./with-threads";

function useThreadStore<T>(
  selector: (store: CustomChatStoreState<ChatMessage>) => T,
  equalityFn?: (a: T, b: T) => boolean
): T {
  const store = useCustomChatStoreApi<ChatMessage>();
  if (!store) {
    throw new Error("useThreadStore must be used within ChatStoreProvider");
  }
  return useStoreWithEqualityFn(store, selector, equalityFn);
}

export const useThreadEpoch = () =>
  useThreadStore((state) => state.threadEpoch);

export const useThreadInitialMessages = () =>
  useThreadStore((state) => state.threadInitialMessages);

export const useResetThreadEpoch = () => {
  const store = useCustomChatStoreApi<ChatMessage>();
  return useCallback(() => {
    store.getState().resetThreadEpoch();
  }, [store]);
};

export const useSetMessagesWithEpoch = () => {
  const store = useCustomChatStoreApi<ChatMessage>();
  return useCallback(
    (messages: ChatMessage[]) => {
      store.getState().setMessagesWithEpoch(messages);
    },
    [store]
  );
};

export const useAllMessages = () =>
  useThreadStore((state) => state.allMessages);

export const useSetAllMessages = () => {
  const store = useCustomChatStoreApi<ChatMessage>();
  return useCallback(
    (messages: ChatMessage[]) => {
      store.getState().setAllMessages(messages);
    },
    [store]
  );
};

export const useAddMessageToTree = () => {
  const store = useCustomChatStoreApi<ChatMessage>();
  return useCallback(
    (message: ChatMessage) => {
      store.getState().addMessageToTree(message);
    },
    [store]
  );
};

/** Reactive hook — re-renders when sibling info for `messageId` changes. */
export function useMessageSiblingInfo(
  messageId: string
): MessageSiblingInfo<ChatMessage> | null {
  return useThreadStore(
    (state) => state.getMessageSiblingInfo(messageId),
    (a, b) => {
      if (a === null && b === null) {
        return true;
      }
      if (a === null || b === null) {
        return false;
      }
      return (
        a.siblingIndex === b.siblingIndex &&
        a.siblings.length === b.siblings.length
      );
    }
  );
}

export const useSwitchToSibling = () => {
  const store = useCustomChatStoreApi<ChatMessage>();
  return useCallback(
    (messageId: string, direction: "prev" | "next") =>
      store.getState().switchToSibling(messageId, direction),
    [store]
  );
};

export function useParallelGroupInfo(
  messageId: string
): ParallelGroupInfo<ChatMessage> | null {
  return useThreadStore(
    (state) => state.getParallelGroupInfo(messageId),
    (a, b) => {
      if (a === null && b === null) {
        return true;
      }

      if (a === null || b === null) {
        return false;
      }

      return (
        a.parallelGroupId === b.parallelGroupId &&
        a.selectedMessageId === b.selectedMessageId &&
        a.messages.length === b.messages.length &&
        a.messages.every(
          (msg, i) =>
            msg.id === b.messages[i]?.id &&
            msg.metadata?.activeStreamId === b.messages[i]?.metadata?.activeStreamId
        )
      );
    }
  );
}

export const useSwitchToMessage = () => {
  const store = useCustomChatStoreApi<ChatMessage>();
  return useCallback(
    (messageId: string) => store.getState().switchToMessage(messageId),
    [store]
  );
};
