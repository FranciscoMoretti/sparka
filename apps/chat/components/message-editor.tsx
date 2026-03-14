"use client";
import { useChatStatus } from "@ai-sdk-tools/store";
import { type Dispatch, type SetStateAction, useCallback } from "react";
import type { ModelId } from "@/lib/ai/app-models";
import { getPrimarySelectedModelId, type ChatMessage } from "@/lib/ai/types";
import {
  getAttachmentsFromMessage,
  getTextContentFromMessage,
} from "@/lib/utils";
import { ChatInputProvider } from "@/providers/chat-input-provider";
import { MultimodalInput } from "./multimodal-input";

export interface MessageEditorProps {
  chatId: string;
  message: ChatMessage;
  parentMessageId: string | null;
  setMode: Dispatch<SetStateAction<"view" | "edit">>;
}

function MessageEditorContent({
  chatId,
  setMode,
  parentMessageId,
}: MessageEditorProps & { onModelChange?: (modelId: string) => void }) {
  const status = useChatStatus();

  const handleOnSendMessage = useCallback(
    (_: ChatMessage) => {
      setMode("view");
    },
    [setMode]
  );

  return (
    <div className="w-full">
      <MultimodalInput
        chatId={chatId}
        isEditMode={true}
        onSendMessage={handleOnSendMessage}
        parentMessageId={parentMessageId}
        status={status}
      />
    </div>
  );
}

export function MessageEditor(
  props: MessageEditorProps & { onModelChange?: (modelId: string) => void }
) {
  // Get the initial input value from the message content
  const initialInput = getTextContentFromMessage(props.message);
  const initialAttachments = getAttachmentsFromMessage(props.message);

  // Use selectedModel from the message metadata, or fall back to current selected model
  const messageSelectedModel = getPrimarySelectedModelId(
    props.message.metadata?.selectedModel
  ) as ModelId | null;
  const { parentMessageId: _parentMessageId, ...rest } = props;
  return (
    <ChatInputProvider
      initialAttachments={initialAttachments}
      initialInput={initialInput}
      initialTool={props.message.metadata?.selectedTool}
      key={`edit-${props.message.id}`}
      localStorageEnabled={false}
      overrideModelId={messageSelectedModel || undefined}
    >
      <MessageEditorContent
        {...rest}
        parentMessageId={props.message.metadata?.parentMessageId}
      />
    </ChatInputProvider>
  );
}
