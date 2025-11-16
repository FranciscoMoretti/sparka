import type { LanguageModelUsage } from "ai";
import type { AppModelId } from "@/lib/ai/app-models";
import { createCoreChatAgent } from "@/lib/ai/core-chat-agent";
import { generateFollowupSuggestions } from "@/lib/ai/followup-suggestions";
import { systemPrompt } from "@/lib/ai/prompts";
import type { ChatMessage, StreamWriter, ToolName } from "@/lib/ai/types";
import { generateUUID } from "@/lib/utils";

// No-op StreamWriter for evals - tools can write but nothing happens
function createNoOpStreamWriter(): StreamWriter {
  return {
    write: () => {
      // Intentional no-op for evaluation context
    },
    merge: () => {
      // Intentional no-op for evaluation context
    },
  } as unknown as StreamWriter;
}

export type EvalAgentResult = {
  finalText: string;
  assistantMessage: ChatMessage;
  usage: LanguageModelUsage | undefined;
  toolResults: Array<{
    toolName: string;
    type: string;
    state?: string;
  }>;
  followupSuggestions: string[];
};

function processToolCall(
  content: {
    type: "tool-call";
    toolCallId?: string;
    toolName: string;
    input: unknown;
  },
  parts: ChatMessage["parts"],
  toolResults: Array<{ toolName: string; type: string; state?: string }>
): void {
  const toolCallId = content.toolCallId || generateUUID();
  const toolPartType = `tool-${content.toolName}` as const;
  parts.push({
    type: toolPartType,
    toolCallId,
    state: "input-available",
    input: content.input,
  } as ChatMessage["parts"][number]);
  toolResults.push({
    toolName: content.toolName,
    type: toolPartType,
    state: "input-available",
  });
}

function processToolResult(
  content: {
    type: "tool-result";
    toolCallId: string;
    toolName: string;
    output: unknown;
  },
  parts: ChatMessage["parts"],
  toolResults: Array<{ toolName: string; type: string; state?: string }>
): void {
  const toolCallId = content.toolCallId;
  const partIndex = parts.findIndex(
    (p) =>
      p.type.startsWith("tool-") &&
      "toolCallId" in p &&
      p.toolCallId === toolCallId
  );

  if (partIndex >= 0) {
    const part = parts[partIndex];
    if (part.type.startsWith("tool-") && "state" in part) {
      parts[partIndex] = {
        ...part,
        state: "output-available",
        output: content.output,
      } as ChatMessage["parts"][number];
    }
  } else {
    // Tool result without a prior call (shouldn't happen, but handle it)
    const toolPartType = `tool-${content.toolName}` as const;
    parts.push({
      type: toolPartType,
      toolCallId: toolCallId || generateUUID(),
      state: "output-available",
      output: content.output,
    } as ChatMessage["parts"][number]);
  }

  const existingIndex = toolResults.findIndex(
    (tr) => tr.toolName === content.toolName
  );
  if (existingIndex >= 0) {
    toolResults[existingIndex] = {
      ...toolResults[existingIndex],
      state: "output-available",
    };
  } else {
    toolResults.push({
      toolName: content.toolName,
      type: `tool-${content.toolName}`,
      state: "output-available",
    });
  }
}

async function extractFollowupSuggestions(
  followupSuggestionsResult: Awaited<
    ReturnType<typeof generateFollowupSuggestions>
  >
): Promise<string[]> {
  const suggestions: string[] = [];
  for await (const chunk of followupSuggestionsResult.partialObjectStream) {
    if (chunk.suggestions) {
      suggestions.push(
        ...chunk.suggestions.filter((s): s is string => s !== undefined)
      );
    }
  }

  return suggestions.length > 0 ? suggestions.slice(-5) : [];
}

export async function runCoreChatAgentEval({
  userMessage,
  previousMessages = [],
  selectedModelId,
  selectedTool = null,
  userId = null,
  activeTools,
  abortSignal,
}: {
  userMessage: ChatMessage;
  previousMessages?: ChatMessage[];
  selectedModelId: AppModelId;
  selectedTool?: ToolName | null;
  userId?: string | null;
  activeTools: ToolName[];
  abortSignal?: AbortSignal;
}): Promise<EvalAgentResult> {
  const messageId = generateUUID();
  const noOpStreamWriter = createNoOpStreamWriter();

  // Create the core agent
  const { result, contextForLLM } = await createCoreChatAgent({
    system: systemPrompt(),
    userMessage,
    previousMessages,
    selectedModelId,
    selectedTool,
    userId,
    activeTools,
    abortSignal,
    messageId,
    dataStream: noOpStreamWriter,
    onError: (error) => {
      // Silently handle errors in evals - let them propagate naturally
      throw error;
    },
  });

  // Consume the stream to completion
  await result.consumeStream();

  // Get the final response
  const response = await result.response;
  const output = await result.output;

  // Extract tool results and build parts from result steps
  const toolResults: Array<{
    toolName: string;
    type: string;
    state?: string;
  }> = [];
  const parts: ChatMessage["parts"] = [];

  // Add text part if there's output
  if (output) {
    parts.push({
      type: "text",
      text: output,
    });
  }

  // Extract tool calls and results from result steps (not response.steps)
  // The steps are available on the result object itself
  const steps = (await result.steps) ?? [];
  for (const step of steps) {
    for (const content of step.content) {
      if (content.type === "tool-call") {
        processToolCall(content, parts, toolResults);
      } else if (content.type === "tool-result") {
        processToolResult(content, parts, toolResults);
      }
    }
  }

  // Build the assistant message
  const assistantMessage: ChatMessage = {
    id: messageId,
    role: "assistant",
    parts,
    metadata: {
      createdAt: new Date(),
      parentMessageId: userMessage.id,
      isPartial: false,
      selectedModel: selectedModelId,
    },
  };

  // Generate and extract followup suggestions
  const followupSuggestionsResult = generateFollowupSuggestions([
    ...contextForLLM,
    ...response.messages,
  ]);

  const finalSuggestions = await extractFollowupSuggestions(
    followupSuggestionsResult
  );

  // Get usage from result (it's on the result object, not response)
  const usage = await result.usage;

  return {
    finalText: output || "",
    assistantMessage,
    usage,
    toolResults,
    followupSuggestions: finalSuggestions,
  };
}
