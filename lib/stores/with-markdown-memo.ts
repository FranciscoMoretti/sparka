"use client";
import type { UIMessage } from "ai";
import type { StateCreator } from "zustand";
import {
  getMarkdownFromCache,
  type MarkdownCacheEntry,
  precomputeMarkdownForAllMessages,
} from "@/lib/stores/markdown-cache";
import type { BaseChatStoreState } from "./chat-store-base";

export interface MarkdownMemoAugmentedState<UI_MESSAGE extends UIMessage>
  extends BaseChatStoreState<UI_MESSAGE> {
  _markdownCache: Map<string, MarkdownCacheEntry>;
  getMarkdownBlocksForPart: (messageId: string, partIdx: number) => string[];
  getMarkdownBlockCountForPart: (messageId: string, partIdx: number) => number;
  getMarkdownBlockByIndex: (
    messageId: string,
    partIdx: number,
    blockIdx: number
  ) => string | null;
}

const getSelectedPart = <UI_MESSAGE extends UIMessage>(
  get: () => BaseChatStoreState<UI_MESSAGE>,
  messageId: string,
  partIdx: number,
  useFallback = false
): string => {
  const list = useFallback
    ? get()._throttledMessages || get().messages
    : get()._throttledMessages;

  if (!list) {
    throw new Error("No messages available");
  }

  const message = list.find((msg) => msg.id === messageId);
  if (!message) {
    throw new Error(`Message not found for id: ${messageId}`);
  }

  const selected = message.parts[partIdx];
  if (!selected) {
    throw new Error(
      `Part not found for id: ${messageId} at partIdx: ${partIdx}`
    );
  }

  if (selected.type !== "text") {
    throw new Error(
      `Part type mismatch for id: ${messageId} at partIdx: ${partIdx}. Expected text, got ${String(
        selected.type
      )}`
    );
  }

  return selected.text || "";
};

const getCachedMarkdown = (
  cache: Map<string, MarkdownCacheEntry>,
  messageId: string,
  partIdx: number,
  text: string
): MarkdownCacheEntry | null =>
  getMarkdownFromCache({
    cache,
    messageId,
    partIdx,
    text,
  });

export const withMarkdownMemo =
  <UI_MESSAGE extends UIMessage>(initialMessages: UI_MESSAGE[] = []) =>
  <T extends BaseChatStoreState<UI_MESSAGE>>(
    creator: StateCreator<T, [], []>
  ): StateCreator<T & MarkdownMemoAugmentedState<UI_MESSAGE>, [], []> =>
  (set, get, api) => {
    const initialPrecompute = precomputeMarkdownForAllMessages(initialMessages);
    const base = creator(set, get, api);
    base.registerThrottledMessagesEffect(() => {
      const state = get();
      const { cache } = precomputeMarkdownForAllMessages(
        state.messages,
        get()._markdownCache
      );
      set({
        _markdownCache: cache,
      } as Partial<
        T &
          Omit<
            MarkdownMemoAugmentedState<UI_MESSAGE>,
            keyof BaseChatStoreState<UI_MESSAGE>
          >
      >);
    });
    return {
      ...base,
      _markdownCache: initialPrecompute.cache,
      getMarkdownBlocksForPart: (messageId: string, partIdx: number) => {
        const text = getSelectedPart(get, messageId, partIdx, false);
        const cached = getCachedMarkdown(
          get()._markdownCache,
          messageId,
          partIdx,
          text
        );
        return cached ? cached.blocks : [];
      },
      getMarkdownBlockCountForPart: (messageId: string, partIdx: number) => {
        const text = getSelectedPart(get, messageId, partIdx, true);
        const cached = getCachedMarkdown(
          get()._markdownCache,
          messageId,
          partIdx,
          text
        );
        const PREALLOCATED_BLOCKS = 100;
        if (cached) {
          return Math.max(
            PREALLOCATED_BLOCKS,
            Math.ceil(cached.blocks.length / PREALLOCATED_BLOCKS) *
              PREALLOCATED_BLOCKS
          );
        }
        return PREALLOCATED_BLOCKS;
      },
      getMarkdownBlockByIndex: (
        messageId: string,
        partIdx: number,
        blockIdx: number
      ) => {
        const text = getSelectedPart(get, messageId, partIdx, false);
        const cached = getCachedMarkdown(
          get()._markdownCache,
          messageId,
          partIdx,
          text
        );
        const blocks = cached ? cached.blocks : [];
        if (blockIdx < 0 || blockIdx >= blocks.length) {
          return null;
        }
        return blocks[blockIdx] ?? null;
      },
    };
  };
