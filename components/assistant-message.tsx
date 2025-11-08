"use client";
import { memo } from "react";
import { useChatId } from "@/lib/stores/hooks-base";
import {
  Message as AIMessage,
  MessageContent as AIMessageContent,
} from "./ai-elements/message";
import { FollowUpSuggestionsParts } from "./followup-suggestions";
import { MessageActions } from "./message-actions";
import { SourcesAnnotations } from "./part/message-annotations";
import { MessageParts } from "./message-parts";
import { PartialMessageLoading } from "./partial-message-loading";
import type { BaseMessageProps } from "./user-message";

const PureAssistantMessage = ({
  messageId,
  vote,
  isLoading,
  isReadonly,
}: Omit<BaseMessageProps, "parentMessageId">) => {
  const chatId = useChatId();

  if (!chatId) {
    return null;
  }

  return (
    <AIMessage className="w-full items-start py-1" from="assistant" >
      <AIMessageContent className="w-full px-0 py-0 text-left" variant="flat">
        <PartialMessageLoading messageId={messageId} />
        <MessageParts
          isLoading={isLoading}
          isReadonly={isReadonly}
          messageId={messageId}
        />

        <SourcesAnnotations
          key={`sources-annotations-${messageId}`}
          messageId={messageId}
        />

        <MessageActions
          chatId={chatId}
          isLoading={isLoading}
          isReadOnly={isReadonly}
          key={`action-${messageId}`}
          messageId={messageId}
          vote={vote}
        />
        {isReadonly ? null : <FollowUpSuggestionsParts messageId={messageId} />}
      </AIMessageContent>
    </AIMessage>
  );
};
export const AssistantMessage = memo(
  PureAssistantMessage,
  (prevProps, nextProps) => {
    if (prevProps.messageId !== nextProps.messageId) {
      return false;
    }
    if (prevProps.vote !== nextProps.vote) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.isReadonly !== nextProps.isReadonly) {
      return false;
    }
    return true;
  }
);
