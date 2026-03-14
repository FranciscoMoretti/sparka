"use client";

import { useMessageById } from "@ai-sdk-tools/store";
import { LoaderCircle } from "lucide-react";
import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  expandSelectedModelValue,
  getPrimarySelectedModelId,
  type ChatMessage,
} from "@/lib/ai/types";
import { useParallelGroupInfo } from "@/lib/stores/hooks-threads";
import { useChatModels } from "@/providers/chat-models-provider";
import { cn } from "@/lib/utils";
import { useNavigateToMessage } from "@/hooks/use-navigate-to-message";

function PureParallelResponseCards({
  messageId,
}: {
  messageId: string;
}) {
  const message = useMessageById<ChatMessage>(messageId);
  const parallelGroupInfo = useParallelGroupInfo(messageId);
  const navigateToMessage = useNavigateToMessage();
  const { getModelById } = useChatModels();

  const cardSlots = useMemo(() => {
    if (
      message.role !== "user" ||
      !message.metadata.parallelGroupId ||
      typeof message.metadata.selectedModel === "string"
    ) {
      return [];
    }

    const requestedModelIds = expandSelectedModelValue(message.metadata.selectedModel);

    return requestedModelIds.map((modelId, parallelIndex) => {
      const actualMessage = parallelGroupInfo?.messages.find(
        (candidate) => candidate.metadata.parallelIndex === parallelIndex
      );

      return {
        modelId,
        parallelIndex,
        message: actualMessage ?? null,
      };
    });
  }, [message, parallelGroupInfo]);

  const selectedParallelIndex = useMemo(() => {
    if (parallelGroupInfo?.selectedMessageId) {
      const selectedMessage = parallelGroupInfo.messages.find(
        (candidate) => candidate.id === parallelGroupInfo.selectedMessageId
      );
      if (typeof selectedMessage?.metadata.parallelIndex === "number") {
        return selectedMessage.metadata.parallelIndex;
      }
    }

    return cardSlots.length > 0 ? 0 : null;
  }, [cardSlots.length, parallelGroupInfo]);

  if (cardSlots.length <= 1) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {cardSlots.map((slot) => {
        const modelId =
          slot.message?.metadata.selectedModel
            ? getPrimarySelectedModelId(slot.message.metadata.selectedModel)
            : slot.modelId;
        const modelName = modelId ? getModelById(modelId)?.name ?? modelId : "Model";
        const isSelected = selectedParallelIndex === slot.parallelIndex;
        const isStreaming = slot.message
          ? slot.message.metadata.activeStreamId !== null
          : true;
        const statusLabel = isSelected
          ? "Selected"
          : isStreaming
            ? "Generating..."
            : "Task completed";

        return (
          <Button
            className={cn(
              "h-auto min-w-[160px] flex-col items-start gap-1 rounded-xl px-3 py-2 text-left",
              isSelected && "border-primary bg-primary/5 text-primary"
            )}
            disabled={!slot.message}
            key={`${message.id}-${slot.parallelIndex}`}
            onClick={() => {
              if (slot.message) {
                navigateToMessage(slot.message.id);
              }
            }}
            type="button"
            variant="outline"
          >
            <span className="font-medium text-sm">{modelName}</span>
            <span className="flex items-center gap-1 text-muted-foreground text-xs">
              {isStreaming ? <LoaderCircle className="size-3 animate-spin" /> : null}
              {statusLabel}
            </span>
          </Button>
        );
      })}
    </div>
  );
}

export const ParallelResponseCards = memo(
  PureParallelResponseCards,
  (prevProps, nextProps) => prevProps.messageId === nextProps.messageId
);
