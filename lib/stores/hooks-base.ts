// This file has hooks that are enabled by the @ai-sdk-tools/store

import { type StoreState, useChatStoreApi } from "@ai-sdk-tools/store";
import equal from "fast-deep-equal";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";
import type { ChatMessage } from "../ai/types";

export function useBaseChatStore<T = StoreState<ChatMessage>>(
  selector?: (store: StoreState<ChatMessage>) => T,
  equalityFn?: (a: T, b: T) => boolean
) {
  const store = useChatStoreApi<ChatMessage>();
  if (!store) {
    throw new Error("useBaseChatStore must be used within ChatStoreProvider");
  }
  const selectorOrIdentity =
    (selector as (s: StoreState<ChatMessage>) => T) ??
    ((s: StoreState<ChatMessage>) => s);
  return useStoreWithEqualityFn(store, selectorOrIdentity, equalityFn);
}

// Base selector hooks using throttled messages where relevant
export const useMessageIds = () =>
  useBaseChatStore((state) => state.getMessageIds(), shallow);

export const useLastUsageUntilMessageId = (messageId: string | null) =>
  useBaseChatStore((state) => {
    if (!messageId) {
      return;
    }
    const messages = state._throttledMessages || state.messages;
    const messageIdx = messages.findIndex((m) => m.id === messageId);
    if (messageIdx === -1) {
      return;
    }

    const sliced = messages.slice(0, messageIdx + 1);
    return sliced.findLast((m) => m.role === "assistant" && m.metadata?.usage)
      ?.metadata?.usage;
  }, shallow);

export const useMessageRoleById = (messageId: string): ChatMessage["role"] =>
  useBaseChatStore((state) => {
    const message = state
      .getThrottledMessages()
      .find((m) => m.id === messageId);
    if (!message) {
      throw new Error(`Message not found for id: ${messageId}`);
    }
    return message.role;
  });
export const useMessageResearchUpdatePartsById = (
  messageId: string
): Extract<ChatMessage["parts"][number], { type: "data-researchUpdate" }>[] =>
  useBaseChatStore((state) => {
    const message = state
      .getThrottledMessages()
      .find((m) => m.id === messageId);
    if (!message) {
      throw new Error(`Message not found for id: ${messageId}`);
    }
    return message.parts.filter(
      (p) => p.type === "data-researchUpdate"
    ) as Extract<
      ChatMessage["parts"][number],
      { type: "data-researchUpdate" }
    >[];
  }, equal);

export const useMessageMetadataById = (
  messageId: string
): ChatMessage["metadata"] =>
  useBaseChatStore((state) => {
    const message = state
      .getThrottledMessages()
      .find((m) => m.id === messageId);
    if (!message) {
      throw new Error(`Message not found for id: ${messageId}`);
    }
    return message.metadata;
  }, shallow);

export const useLastMessageId = () =>
  useBaseChatStore((state) => state.getLastMessageId());
