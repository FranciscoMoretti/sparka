"use client";

import { memo } from "react";
import { Response } from "../ai-elements/response";

export const TextMessagePart = memo(
  ({ text, isLoading }: { text: string; isLoading: boolean }) => (
    <Response isAnimating={isLoading} mode={isLoading ? "streaming" : "static"}>
      {text}
    </Response>
  )
);
