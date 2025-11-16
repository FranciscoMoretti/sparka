"use client";

import { memo } from "react";
import type { ChatMessage } from "@/lib/ai/types";
import { useChatStoreApi } from "@/lib/stores/chat-store-context";
import {
  useMessagePartByPartIdx,
  useMessagePartsByPartRange,
  useMessagePartTypesById,
} from "@/lib/stores/hooks-message-parts";
import { isLastArtifact } from "./is-last-artifact";
import { CodeInterpreterMessage } from "./part/code-interpreter";
import { CreateDocumentMessage } from "./part/create-document-message";
import { DocumentToolResult } from "./part/document-common";
import { DocumentPreview } from "./part/document-preview";
import { GeneratedImage } from "./part/generated-image";
import { ResearchUpdates } from "./part/message-annotations";
import { MessageReasoning } from "./part/message-reasoning";
import { ReadDocument } from "./part/read-document";
import { RequestSuggestionsMessage } from "./part/request-suggestions-message";
import { Retrieve } from "./part/retrieve";
import { TextMessagePart } from "./part/text-message-part";
import { UpdateDocumentMessage } from "./part/update-document-message";
import { Weather } from "./part/weather";

type MessagePartsProps = {
  messageId: string;
  isLoading: boolean;
  isReadonly: boolean;
};

// TODO: Transform this
function useResearchUpdates(
  messageId: string,
  partIdx: number,
  type: ChatMessage["parts"][number]["type"]
) {
  const types = useMessagePartTypesById(messageId);
  const startIdx = partIdx;
  const nextIdx = types.findIndex(
    (t, i) =>
      i > startIdx && (t === "tool-deepResearch" || t === "tool-webSearch")
  );

  // If not a research tool, constrain the range to empty to minimize work
  let sliceEnd = nextIdx === -1 ? types.length - 1 : nextIdx - 1;
  if (type !== "tool-deepResearch" && type !== "tool-webSearch") {
    sliceEnd = startIdx;
  }

  const range = useMessagePartsByPartRange(messageId, startIdx + 1, sliceEnd);

  if (type !== "tool-deepResearch" && type !== "tool-webSearch") {
    return [] as Extract<
      ChatMessage["parts"][number],
      { type: "data-researchUpdate" }
    >["data"][];
  }

  return range
    .filter((p) => p.type === "data-researchUpdate")
    .map(
      (u) =>
        (
          u as Extract<
            ChatMessage["parts"][number],
            { type: "data-researchUpdate" }
          >
        ).data
    );
}

// Render deep research tool
function renderDeepResearchPart({
  part,
  researchUpdates,
  messageId,
  isReadonly,
  chatStore,
}: {
  part: Extract<ChatMessage["parts"][number], { type: "tool-deepResearch" }>;
  researchUpdates: ChatMessage["parts"][number]["data"];
  messageId: string;
  isReadonly: boolean;
  chatStore: ReturnType<typeof useChatStoreApi>;
}) {
  const { toolCallId, state } = part;

  if (state === "input-available") {
    return (
      <div className="flex w-full flex-col gap-3" key={toolCallId}>
        <ResearchUpdates updates={researchUpdates} />
      </div>
    );
  }
  if (state === "output-available") {
    const { output, input } = part;
    const shouldShowFullPreview = isLastArtifact(
      chatStore.getState().messages,
      toolCallId
    );

    if (output.format === "report") {
      return (
        <div key={toolCallId}>
          <div className="mb-2">
            <ResearchUpdates updates={researchUpdates} />
          </div>
          {shouldShowFullPreview ? (
            <DocumentPreview
              args={input}
              isReadonly={isReadonly}
              messageId={messageId}
              result={output}
              type="create"
            />
          ) : (
            <DocumentToolResult
              isReadonly={isReadonly}
              messageId={messageId}
              result={output}
              type="create"
            />
          )}
        </div>
      );
    }
  }
  return null;
}

// Render web search tool
function renderWebSearchPart(
  part: Extract<ChatMessage["parts"][number], { type: "tool-webSearch" }>,
  researchUpdates: ChatMessage["parts"][number]["data"]
) {
  const { toolCallId, state } = part;

  if (state === "input-available" || state === "output-available") {
    return (
      <div className="flex flex-col gap-3" key={toolCallId}>
        <ResearchUpdates updates={researchUpdates} />
      </div>
    );
  }
  return null;
}

// Render a single part by index with minimal subscriptions
function PureMessagePart({
  messageId,
  partIdx,
  isReadonly,
}: {
  messageId: string;
  partIdx: number;
  isReadonly: boolean;
}) {
  const part = useMessagePartByPartIdx(messageId, partIdx);
  const { type } = part;
  const researchUpdates = useResearchUpdates(messageId, partIdx, type);
  const chatStore = useChatStoreApi();

  switch (type) {
    case "tool-getWeather":
      return <Weather key={part.toolCallId} tool={part} />;
    case "tool-createDocument":
      return (
        <CreateDocumentMessage
          isReadonly={isReadonly}
          key={part.toolCallId}
          messageId={messageId}
          tool={part}
        />
      );
    case "tool-updateDocument":
      return (
        <UpdateDocumentMessage
          isReadonly={isReadonly}
          key={part.toolCallId}
          messageId={messageId}
          tool={part}
        />
      );
    case "tool-requestSuggestions":
      return (
        <RequestSuggestionsMessage
          isReadonly={isReadonly}
          key={part.toolCallId}
          messageId={messageId}
          tool={part}
        />
      );
    case "tool-retrieve":
      return <Retrieve key={part.toolCallId} tool={part} />;
    case "tool-readDocument":
      return <ReadDocument key={part.toolCallId} tool={part} />;
    case "tool-codeInterpreter":
      return <CodeInterpreterMessage key={part.toolCallId} tool={part} />;
    case "tool-generateImage":
      return <GeneratedImage key={part.toolCallId} tool={part} />;
    case "tool-deepResearch":
      return renderDeepResearchPart({
        part,
        researchUpdates,
        messageId,
        isReadonly,
        chatStore,
      });
    case "tool-webSearch":
      return renderWebSearchPart(part, researchUpdates);
    default:
      return null;
  }
}

const MessagePart = memo(PureMessagePart);

// Render a single reasoning part by index
function PureReasoningPart({
  messageId,
  isLoading,
  partIdx,
}: {
  messageId: string;
  isLoading: boolean;
  partIdx: number;
}) {
  const part = useMessagePartByPartIdx(messageId, partIdx);
  if (part.type !== "reasoning") {
    return null;
  }

  return <MessageReasoning content={part.text} isLoading={isLoading} />;
}

const ReasoningPart = memo(PureReasoningPart);

export function PureMessageParts({
  messageId,
  isLoading,
  isReadonly,
}: MessagePartsProps) {
  const types = useMessagePartTypesById(messageId);

  return types.map((t, i) => {
    if (t === "reasoning") {
      const key = `message-${messageId}-reasoning-${i}`;
      const isLast = i === types.length - 1;
      return (
        <ReasoningPart
          isLoading={isLoading && isLast}
          key={key}
          messageId={messageId}
          partIdx={i}
        />
      );
    }

    if (t === "text") {
      const key = `message-${messageId}-text-${i}`;
      return <TextMessagePart key={key} messageId={messageId} partIdx={i} />;
    }

    const key = `message-${messageId}-part-${i}-${t}`;
    return (
      <MessagePart
        isReadonly={isReadonly}
        key={key}
        messageId={messageId}
        partIdx={i}
      />
    );
  });
}

export const MessageParts = memo(PureMessageParts);
