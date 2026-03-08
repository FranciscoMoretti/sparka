import type { ToolUIPart } from "ai";
import type { ComponentType } from "react";
import { renderers } from "@/lib/ai/plugins";
import type { ChatTools } from "@/lib/ai/types";

// The props every plugin tool renderer receives.
// `tool` is the full ChatTools union — narrow it inside the renderer using
// `Extract<typeof tool, { type: "tool-yourToolName" }>` to get typed input/output.
export type PluginToolRendererProps = {
  tool: ToolUIPart<ChatTools>;
  messageId: string;
  isReadonly: boolean;
};

export const toolRendererRegistry: Partial<
  Record<ToolUIPart<ChatTools>["type"], ComponentType<PluginToolRendererProps>>
> = renderers;
