"use client";
import { memo } from "react";
import {
  Reasoning,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { ReasoningContentContainer } from "@/components/ai-elements/extra/reasoning-content-container";
import { Response } from "@/components/ai-elements/response";

type MessageReasoningProps = {
  isLoading: boolean;
  reasoning: string[];
};

function PureMessageReasoning({ isLoading, reasoning }: MessageReasoningProps) {
  return (
    <Reasoning className="mb-2" isStreaming={isLoading}>
      <ReasoningTrigger data-testid="message-reasoning-toggle " />
      <ReasoningContentContainer
        className="mt-0 flex flex-col gap-4 text-muted-foreground data-[state=open]:mt-3"
        data-testid="message-reasoning"
      >
        <MultiReasoningContent reasoning={reasoning} />
      </ReasoningContentContainer>
    </Reasoning>
  );
}

const MultiReasoningContent = memo(function MultiReasoningContent({
  reasoning,
}: {
  reasoning: string[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {reasoning.map((r, i) => (
        <div className="border-l pl-4" key={i}>
          <Response className="grid gap-2">{r}</Response>
        </div>
      ))}
    </div>
  );
});

export const MessageReasoning = memo(PureMessageReasoning);
