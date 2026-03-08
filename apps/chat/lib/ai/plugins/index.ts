// All plugin tools and renderers installed via `chatjs add`.
// This file is fully managed by the CLI — do not edit manually.

// [chatjs-registry:imports]
import { WordCountRenderer } from "@/components/part/plugins/word-count";
import { wordCount } from "@/lib/ai/tools/plugins/word-count";
// [/chatjs-registry:imports]

export const tools = {
  // [chatjs-registry:tools]
  wordCount,
  // [/chatjs-registry:tools]
} as const;

export const renderers = {
  // [chatjs-registry:renderers]
  "tool-wordCount": WordCountRenderer,
  // [/chatjs-registry:renderers]
};
