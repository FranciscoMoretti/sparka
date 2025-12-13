"use client";

import { useMemo } from "react";
import type { ChatMessage, UiToolName } from "@/lib/ai/types";
import { getDefaultThread } from "@/lib/thread-utils";

type MessageWithNonStringId = Omit<ChatMessage, "id"> & {
  id: string | number;
};

export function useChatSystemInitialState(
  messages: MessageWithNonStringId[] | null | undefined
): {
  initialMessages: ChatMessage[];
  initialTool: UiToolName | null;
} {
  const initialMessages = useMemo<ChatMessage[]>(() => {
    if (!messages) {
      return [];
    }

    return getDefaultThread(
      messages.map((msg) => ({
        ...msg,
        id: msg.id.toString(),
      }))
    );
  }, [messages]);

  const initialTool = useMemo<UiToolName | null>(() => {
    const lastAssistantMessage = messages?.findLast(
      (m) => m.role === "assistant"
    );

    if (!(lastAssistantMessage && Array.isArray(lastAssistantMessage.parts))) {
      return null;
    }

    for (const part of lastAssistantMessage.parts) {
      if (
        part?.type === "tool-deepResearch" &&
        part?.state === "output-available" &&
        part?.output?.format === "clarifying_questions"
      ) {
        return "deepResearch";
      }
    }

    return null;
  }, [messages]);

  return {
    initialMessages,
    initialTool,
  };
}
