"use client";

import { useChatActions } from "@ai-sdk-tools/store";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { memo } from "react";
import type { AppModelId } from "@/lib/ai/app-models";
import type { ChatMessage } from "@/lib/ai/types";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

type SuggestedActionsProps = {
  chatId: string;
  selectedModelId: AppModelId;
  className?: string;
};

function PureSuggestedActions({
  chatId,
  selectedModelId,
  className,
}: SuggestedActionsProps) {
  const router = useRouter();
  const { sendMessage } = useChatActions<ChatMessage>();
  const suggestedActions = [
    {
      title: "What are the advantages",
      label: "of using Next.js?",
      action: "What are the advantages of using Next.js?",
    },
    {
      title: "Write code to",
      label: `demonstrate djikstra's algorithm`,
      action: `Write code to demonstrate djikstra's algorithm`,
    },
    {
      title: "Help me write an essay",
      label: "about silicon valley",
      action: "Help me write an essay about silicon valley",
    },
    {
      title: "What is the weather",
      label: "in San Francisco?",
      action: "What is the weather in San Francisco?",
    },
  ];

  return (
    <div
      className={cn("grid w-full gap-2 sm:grid-cols-2", className)}
      data-testid="suggested-actions"
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className={index > 1 ? "hidden sm:block" : "block"}
          exit={{ opacity: 0, y: 20 }}
          initial={{ opacity: 0, y: 20 }}
          key={`suggested-action-${suggestedAction.title}-${index}`}
          transition={{ delay: 0.05 * index }}
        >
          <Button
            className="h-auto w-full flex-1 items-start justify-start gap-1 rounded-xl border px-4 py-3.5 text-left text-sm sm:flex-col"
            onClick={() => {
              if (!sendMessage) {
                return;
              }

              window.history.pushState({}, "", `/chat/${chatId}`);

              sendMessage(
                {
                  role: "user",
                  parts: [{ type: "text", text: suggestedAction.action }],
                  metadata: {
                    selectedModel: selectedModelId,
                    createdAt: new Date(),
                    parentMessageId: null,
                  },
                },
                {
                  body: {
                    data: {
                      deepResearch: false,
                      webSearch: false,
                      reason: false,
                      generateImage: false,
                      writeOrCode: false,
                    },
                  },
                }
              );
            }}
            variant="ghost"
          >
            <span className="font-medium">{suggestedAction.title}</span>
            <span className="text-muted-foreground">
              {suggestedAction.label}
            </span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions, () => true);
