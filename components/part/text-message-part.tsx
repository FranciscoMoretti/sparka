"use client";

import { memo } from "react";
import { useMessagePartByPartIdx } from "@/lib/stores/hooks-message-parts";

import { Response } from "../ai-elements/response";

export const TextMessagePart = memo(function TextMessagePart({
  messageId,
  partIdx,
}: {
  messageId: string;
  partIdx: number;
}) {
  const part = useMessagePartByPartIdx(messageId, partIdx, "text");
  if (!part) {
    return null;
  }
  return <Response>{part.text}</Response>;
});
