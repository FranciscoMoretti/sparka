"use client";

import type { ToolUIPart } from "ai";
import { toolRendererRegistry } from "@/lib/ai/tool-renderer-registry";
import type { ChatTools } from "@/lib/ai/types";
import { CodeExecution } from "./code-execution";
import { DeepResearch } from "./deep-research";
import { DocumentTool } from "./document-tool";
import { GenerateImage } from "./generate-image";
import { GenerateVideo } from "./generate-video";
import { ReadDocument } from "./read-document";
import { RetrieveUrl } from "./retrieve-url";
import { Weather } from "./weather";
import { WebSearch } from "./web-search";

interface ToolPartProps {
  part: ToolUIPart<ChatTools>;
  messageId: string;
  isReadonly: boolean;
}

export function ToolPart({ part, messageId, isReadonly }: ToolPartProps) {
  const type = part.type;

  if (type === "tool-getWeather") {
    return <Weather tool={part} />;
  }

  if (
    type === "tool-createTextDocument" ||
    type === "tool-createCodeDocument" ||
    type === "tool-createSheetDocument" ||
    type === "tool-editTextDocument" ||
    type === "tool-editCodeDocument" ||
    type === "tool-editSheetDocument"
  ) {
    return (
      <DocumentTool isReadonly={isReadonly} messageId={messageId} tool={part} />
    );
  }

  if (type === "tool-retrieveUrl") {
    return <RetrieveUrl tool={part} />;
  }

  if (type === "tool-readDocument") {
    return <ReadDocument tool={part} />;
  }

  if (type === "tool-codeExecution") {
    return <CodeExecution tool={part} />;
  }

  if (type === "tool-generateImage") {
    return <GenerateImage tool={part} />;
  }

  if (type === "tool-generateVideo") {
    return <GenerateVideo tool={part} />;
  }

  if (type === "tool-deepResearch") {
    return <DeepResearch messageId={messageId} part={part} />;
  }

  if (type === "tool-webSearch") {
    return <WebSearch messageId={messageId} part={part} />;
  }

  // Plugin tools registered via `chatjs add` are dispatched here.
  // Each renderer receives the full typed ToolUIPart<ChatTools> union and
  // can narrow to its specific tool type for typed input/output access.
  const Renderer = toolRendererRegistry[type];
  if (Renderer) {
    return <Renderer isReadonly={isReadonly} messageId={messageId} tool={part} />;
  }

  return null;
}
