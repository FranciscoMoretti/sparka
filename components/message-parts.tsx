"use client";

import type { ToolUIPart } from "ai";
import {
  isDataUIPart,
  isReasoningUIPart,
  isTextUIPart,
  isToolOrDynamicToolUIPart,
  isToolUIPart,
} from "ai";
import { memo } from "react";
import type { ChatTools } from "@/lib/ai/types";
import {
  useMessagePartByPartIdx,
  useMessagePartTypesById,
} from "@/lib/stores/hooks-message-parts";
import { CodeInterpreter } from "./part/code-interpreter";
import { CreateDocument } from "./part/create-document";
import { DeepResearch } from "./part/deep-research";
import { DynamicToolPart } from "./part/dynamic-tool";
import { GeneratedImage } from "./part/generated-image";
import { ReasoningPart } from "./part/message-reasoning";
import { ReadDocument } from "./part/read-document";
import { RequestSuggestions } from "./part/request-suggestions";
import { Retrieve } from "./part/retrieve";
import { TextMessagePart } from "./part/text-message-part";
import { UpdateDocument } from "./part/update-document";
import { Weather } from "./part/weather";
import { WebSearch } from "./part/web-search";

type MessagePartsProps = {
  messageId: string;
  isLoading: boolean;
  isReadonly: boolean;
};

function ToolPart({
  part,
  messageId,
  isReadonly,
}: {
  part: ToolUIPart<ChatTools>;
  messageId: string;
  isReadonly: boolean;
}) {
  const type = part.type;

  if (type === "tool-getWeather") {
    return <Weather tool={part} />;
  }

  if (type === "tool-createDocument") {
    return (
      <CreateDocument
        isReadonly={isReadonly}
        messageId={messageId}
        tool={part}
      />
    );
  }

  if (type === "tool-updateDocument") {
    return (
      <UpdateDocument
        isReadonly={isReadonly}
        messageId={messageId}
        tool={part}
      />
    );
  }

  if (type === "tool-requestSuggestions") {
    return (
      <RequestSuggestions
        isReadonly={isReadonly}
        messageId={messageId}
        tool={part}
      />
    );
  }

  if (type === "tool-retrieve") {
    return <Retrieve tool={part} />;
  }

  if (type === "tool-readDocument") {
    return <ReadDocument tool={part} />;
  }

  if (type === "tool-codeInterpreter") {
    return <CodeInterpreter tool={part} />;
  }

  if (type === "tool-generateImage") {
    return <GeneratedImage tool={part} />;
  }

  if (type === "tool-deepResearch") {
    return (
      <DeepResearch isReadonly={isReadonly} messageId={messageId} part={part} />
    );
  }

  if (type === "tool-webSearch") {
    return <WebSearch messageId={messageId} part={part} />;
  }
  return null;
}

// Render a single part by index with minimal subscriptions
function PureMessagePart({
  messageId,
  partIdx,
  isReadonly,
  isLoading,
}: {
  messageId: string;
  partIdx: number;
  isReadonly: boolean;
  isLoading: boolean;
}) {
  const part = useMessagePartByPartIdx(messageId, partIdx);

  if (isTextUIPart(part)) {
    return <TextMessagePart isLoading={isLoading} text={part.text} />;
  }

  if (isReasoningUIPart(part)) {
    return <ReasoningPart content={part.text} isLoading={isLoading} />;
  }

  if (isDataUIPart(part)) {
    return null;
  }

  if (isToolUIPart(part)) {
    return (
      <ToolPart isReadonly={isReadonly} messageId={messageId} part={part} />
    );
  }
  if (isToolOrDynamicToolUIPart(part)) {
    // Non-dynamic tools are handled beforehand by the ToolPart component
    return (
      <DynamicToolPart
        isReadonly={isReadonly}
        messageId={messageId}
        part={part}
      />
    );
  }
}

const MessagePart = memo(PureMessagePart);

export function PureMessageParts({
  messageId,
  isLoading,
  isReadonly,
}: MessagePartsProps) {
  const types = useMessagePartTypesById(messageId);

  return types.map((t, i) => {
    return (
      <MessagePart
        isLoading={isLoading && i === types.length - 1}
        isReadonly={isReadonly}
        // biome-ignore lint/suspicious/noArrayIndexKey: we only have index at this point
        key={`message-${messageId}-${t}-${i}`}
        messageId={messageId}
        partIdx={i}
      />
    );
  });
}

export const MessageParts = memo(PureMessageParts);
