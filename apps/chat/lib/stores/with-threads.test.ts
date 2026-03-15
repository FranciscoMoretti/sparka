import assert from "node:assert/strict";
import type { StoreState as BaseChatStoreState } from "@ai-sdk-tools/store";
import { describe, it } from "vitest";
import { createStore } from "zustand/vanilla";
import type { ChatMessage } from "../ai/types";
import { withThreads } from "./with-threads";

function createMessage({
  id,
  role,
  createdAt,
  parentMessageId = null,
  parallelGroupId = null,
  parallelIndex = null,
  activeStreamId = null,
}: {
  id: string;
  role: ChatMessage["role"];
  createdAt: string;
  parentMessageId?: string | null;
  parallelGroupId?: string | null;
  parallelIndex?: number | null;
  activeStreamId?: string | null;
}): ChatMessage {
  return {
    id,
    role,
    parts: [],
    metadata: {
      createdAt: new Date(createdAt),
      parentMessageId,
      parallelGroupId,
      parallelIndex,
      isPrimaryParallel: parallelIndex === null ? null : parallelIndex === 0,
      selectedModel: "openai/gpt-4o-mini",
      activeStreamId,
      selectedTool: undefined,
    },
  };
}

function createThreadStore(initialMessages: ChatMessage[]) {
  return createStore<BaseChatStoreState<ChatMessage>>()(
    withThreads<ChatMessage, BaseChatStoreState<ChatMessage>>(
      (set) =>
        ({
          messages: initialMessages,
          setMessages: (messages: ChatMessage[]) => set({ messages }),
        }) as BaseChatStoreState<ChatMessage>
    )
  );
}

describe("withThreads", () => {
  it("preserves local-only optimistic branch nodes across server syncs", () => {
    const rootUser = createMessage({
      id: "user-root",
      role: "user",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    const branchA = createMessage({
      id: "assistant-a",
      role: "assistant",
      createdAt: "2024-01-01T00:00:01.000Z",
      parentMessageId: rootUser.id,
      parallelGroupId: "group-root",
      parallelIndex: 0,
    });
    const branchB = createMessage({
      id: "assistant-b",
      role: "assistant",
      createdAt: "2024-01-01T00:00:02.000Z",
      parentMessageId: rootUser.id,
      parallelGroupId: "group-root",
      parallelIndex: 1,
    });
    const nestedUser = createMessage({
      id: "user-nested",
      role: "user",
      createdAt: "2024-01-01T00:00:03.000Z",
      parentMessageId: branchA.id,
    });
    const nestedBranchA = createMessage({
      id: "assistant-nested-a",
      role: "assistant",
      createdAt: "2024-01-01T00:00:04.000Z",
      parentMessageId: nestedUser.id,
      parallelGroupId: "group-nested",
      parallelIndex: 0,
      activeStreamId: "pending:assistant-nested-a",
    });
    const nestedBranchB = createMessage({
      id: "assistant-nested-b",
      role: "assistant",
      createdAt: "2024-01-01T00:00:05.000Z",
      parentMessageId: nestedUser.id,
      parallelGroupId: "group-nested",
      parallelIndex: 1,
      activeStreamId: "pending:assistant-nested-b",
    });

    const store = createThreadStore([
      rootUser,
      branchA,
      nestedUser,
      nestedBranchA,
    ]);

    store.getState().addMessageToTree(branchB);
    store.getState().addMessageToTree(nestedBranchB);

    store.getState().setMessagesWithEpoch([rootUser, branchB]);
    store.getState().setAllMessages([rootUser, branchA, branchB]);

    const allMessageIds = store
      .getState()
      .allMessages.map((message: ChatMessage) => message.id);
    assert.deepEqual(allMessageIds, [
      "user-root",
      "assistant-a",
      "assistant-b",
      "user-nested",
      "assistant-nested-a",
      "assistant-nested-b",
    ]);

    const restoredThread = store.getState().switchToMessage(branchA.id);
    assert.deepEqual(
      restoredThread?.map((message: ChatMessage) => message.id),
      ["user-root", "assistant-a", "user-nested", "assistant-nested-b"]
    );
    assert.equal(
      restoredThread?.at(-1)?.metadata.activeStreamId,
      "pending:assistant-nested-b"
    );
  });
});
