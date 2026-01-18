import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { ChatMessage } from "./ai/types";
import { cloneMessagesWithDocuments } from "./clone-messages";

function createMessage({
  id,
  parentMessageId = null,
  chatId,
}: {
  id: string;
  parentMessageId?: string | null;
  chatId: string;
}): ChatMessage & { chatId: string } {
  return {
    id,
    role: "user",
    parts: [],
    metadata: {
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      parentMessageId,
      selectedModel: "openai/gpt-4o-mini",
      activeStreamId: null,
    },
    chatId,
  };
}

describe("cloneMessagesWithDocuments", () => {
  it("clones message ids, chatId and parentMessageId thread structure", () => {
    const sourceChatId = "source-chat";
    const newChatId = "new-chat";
    const userId = "user-1";

    const m1 = createMessage({
      id: "m1",
      parentMessageId: null,
      chatId: sourceChatId,
    });
    const m2 = createMessage({
      id: "m2",
      parentMessageId: "m1",
      chatId: sourceChatId,
    });
    const m3 = createMessage({
      id: "m3",
      parentMessageId: "m2",
      chatId: sourceChatId,
    });

    const { clonedMessages, messageIdMap } = cloneMessagesWithDocuments(
      [m1, m2, m3],
      [],
      newChatId,
      userId
    );

    assert.equal(clonedMessages.length, 3);

    // IDs should all be new and unique
    const newIds = clonedMessages.map((m) => m.id);
    assert.equal(new Set(newIds).size, 3);
    assert(!newIds.includes("m1"));
    assert(!newIds.includes("m2"));
    assert(!newIds.includes("m3"));

    // All messages should belong to the new chat
    for (const msg of clonedMessages) {
      assert.equal(msg.chatId, newChatId);
    }

    const newM1Id = messageIdMap.get("m1");
    const newM2Id = messageIdMap.get("m2");
    const newM3Id = messageIdMap.get("m3");

    assert(newM1Id);
    assert(newM2Id);
    assert(newM3Id);

    const clonedM1 = clonedMessages.find((m) => m.id === newM1Id);
    const clonedM2 = clonedMessages.find((m) => m.id === newM2Id);
    const clonedM3 = clonedMessages.find((m) => m.id === newM3Id);

    assert(clonedM1);
    assert(clonedM2);
    assert(clonedM3);

    // Root has no parent
    assert.equal(clonedM1.metadata.parentMessageId, null);

    // Second-level message should point to cloned root
    assert.equal(clonedM2.metadata.parentMessageId, newM1Id);

    // Third-level message should point to cloned second-level
    assert.equal(clonedM3.metadata.parentMessageId, newM2Id);
  });

  it("clones documents and updates document references in message parts", () => {
    const sourceChatId = "source-chat";
    const newChatId = "new-chat";
    const userId = "user-1";

    const messageWithDoc = createMessage({
      id: "m-doc",
      parentMessageId: null,
      chatId: sourceChatId,
    });

    // Minimal tool parts that reference a document id.
    // Shapes match the actual tool output types so the test type-checks.
    messageWithDoc.parts = [
      {
        type: "tool-createDocument",
        toolCallId: "call-create",
        state: "output-available",
        input: {
          title: "Doc title",
          description: "desc",
          kind: "text",
        },
        output: {
          id: "doc-1",
          title: "Doc title",
          kind: "text",
          content: "A document was created and is now visible to the user.",
        },
      },
      {
        type: "tool-updateDocument",
        toolCallId: "call-update",
        state: "output-available",
        input: {
          id: "doc-1",
          prompt: "desc",
        },
        output: {
          id: "doc-1",
          title: "Doc title",
          kind: "text",
          content: "The document has been updated successfully.",
          success: true,
        },
      },
      {
        type: "tool-deepResearch",
        toolCallId: "call-deep",
        state: "output-available",
        input: {},
        output: {
          id: "doc-1",
          title: "Doc title",
          kind: "text",
          content: "Deep research report content",
          format: "report",
        },
      },
    ];

    const sourceDocuments = [
      {
        id: "doc-1",
        messageId: "m-doc",
        userId: "source-user",
        title: "Doc title",
        kind: "text",
        content: "hello",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      },
    ];

    const { clonedMessages, clonedDocuments, messageIdMap, documentIdMap } =
      cloneMessagesWithDocuments(
        [messageWithDoc],
        sourceDocuments,
        newChatId,
        userId
      );

    assert.equal(clonedMessages.length, 1);
    assert.equal(clonedDocuments.length, 1);

    const newMessageId = messageIdMap.get("m-doc");
    const newDocumentId = documentIdMap.get("doc-1");

    assert(newMessageId);
    assert(newDocumentId);

    const clonedMessage = clonedMessages[0];
    const clonedDocument = clonedDocuments[0];

    // Document should point to cloned message and new user
    assert.equal(clonedDocument.messageId, newMessageId);
    assert.equal(clonedDocument.userId, userId);
    assert.equal(clonedDocument.id, newDocumentId);

    // All tool parts in the cloned message should reference the new document id
    for (const part of clonedMessage.parts) {
      if (
        (part.type === "tool-createDocument" ||
          part.type === "tool-updateDocument" ||
          part.type === "tool-deepResearch") &&
        part.state === "output-available" &&
        part.output &&
        "id" in part.output
      ) {
        assert.equal(part.output.id, newDocumentId);
      }
    }
  });
});
