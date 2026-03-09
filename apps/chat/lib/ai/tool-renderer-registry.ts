import type { ToolUIPart } from "ai";
import type { ComponentType } from "react";
import { ui } from "@/lib/ai/tools";
import type { ChatTools } from "@/lib/ai/types";

// The props every tool renderer receives.
// `tool` is the full ChatTools union — narrow it inside the renderer using
// `Extract<typeof tool, { type: "tool-yourToolName" }>` to get typed input/output.
export type ToolRendererProps = {
  tool: ToolUIPart<ChatTools>;
  messageId: string;
  isReadonly: boolean;
};

export const toolRendererRegistry: Partial<
  Record<ToolUIPart<ChatTools>["type"], ComponentType<ToolRendererProps>>
> = ui;
