import type { LanguageModelUsage } from "ai";
import type { AppModelId } from "@/lib/ai/app-models";
import { createCoreChatAgent } from "@/lib/ai/core-chat-agent";
import { determineExplicitlyRequestedTools } from "@/lib/ai/determine-explicitly-requested-tools";
import { generateFollowupSuggestions } from "@/lib/ai/followup-suggestions";
import { systemPrompt } from "@/lib/ai/prompts";
import type { ChatMessage, StreamWriter, ToolName } from "@/lib/ai/types";
import { CostAccumulator } from "@/lib/credits/cost-accumulator";
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

export interface EvalAgentResult {
  assistantMessage: ChatMessage;
  finalText: string;
  followupSuggestions: string[];
  toolResults: Array<{
    toolName: string;
    type: string;
    state?: string;
  }>;
  usage: LanguageModelUsage | undefined;
}

async function executeAgentAndGetOutput({
  userMessage,
  previousMessages,
  selectedModelId,
  explicitlyRequestedTools,
  userId,
  abortSignal,
  messageId,
}: {
  userMessage: ChatMessage;
  previousMessages: ChatMessage[];
  selectedModelId: AppModelId;
  explicitlyRequestedTools: ToolName[] | null;
  userId: string | null;
  abortSignal: AbortSignal | undefined;
  messageId: string;
}): Promise<{
  result: Awaited<ReturnType<typeof createCoreChatAgent>>["result"];
  contextForLLM: Awaited<
    ReturnType<typeof createCoreChatAgent>
  >["contextForLLM"];
  output: string;
  response: Awaited<
    Awaited<ReturnType<typeof createCoreChatAgent>>["result"]["response"]
  >;
}> {
  const noOpStreamWriter = createNoOpStreamWriter();

  const { result, contextForLLM } = await createCoreChatAgent({
    system: systemPrompt(),
    userMessage,
    previousMessages,
    selectedModelId,
    explicitlyRequestedTools,
    userId,
    abortSignal,
    messageId,
    dataStream: noOpStreamWriter,
    onError: (error) => {
      throw error;
    },
    costAccumulator: new CostAccumulator(), // Discarded for evals
  });

  await result.consumeStream();
  const response = await result.response;
  const output = await result.output;

  return { result, contextForLLM, output: output || "", response };
}

function processToolCall(
  content: { toolCallId?: string; toolName: string; input: unknown },
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

function updateExistingToolPart(
  parts: ChatMessage["parts"],
  toolCallId: string | undefined,
  output: unknown
): boolean {
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
        output,
      } as ChatMessage["parts"][number];
    }
    return true;
  }

  return false;
}

function addToolResultPart(
  content: { toolCallId?: string; toolName: string; output: unknown },
  parts: ChatMessage["parts"]
): void {
  const toolPartType = `tool-${content.toolName}` as const;
  parts.push({
    type: toolPartType,
    toolCallId: content.toolCallId || generateUUID(),
    state: "output-available",
    output: content.output,
  } as ChatMessage["parts"][number]);
}

function updateToolResults(
  toolResults: Array<{ toolName: string; type: string; state?: string }>,
  toolName: string
): void {
  const existingIndex = toolResults.findIndex((tr) => tr.toolName === toolName);
  if (existingIndex >= 0) {
    toolResults[existingIndex] = {
      ...toolResults[existingIndex],
      state: "output-available",
    };
  } else {
    toolResults.push({
      toolName,
      type: `tool-${toolName}`,
      state: "output-available",
    });
  }
}

function processToolResult(
  content: { toolCallId?: string; toolName: string; output: unknown },
  parts: ChatMessage["parts"],
  toolResults: Array<{ toolName: string; type: string; state?: string }>
): void {
  const updated = updateExistingToolPart(
    parts,
    content.toolCallId,
    content.output
  );
  if (!updated) {
    addToolResultPart(content, parts);
  }
  updateToolResults(toolResults, content.toolName);
}

function extractToolCallsAndResults(
  steps: Awaited<
    Awaited<ReturnType<typeof createCoreChatAgent>>["result"]["steps"]
  >
): {
  parts: ChatMessage["parts"];
  toolResults: Array<{ toolName: string; type: string; state?: string }>;
} {
  const toolResults: Array<{
    toolName: string;
    type: string;
    state?: string;
  }> = [];
  const parts: ChatMessage["parts"] = [];

  for (const step of steps ?? []) {
    for (const content of step.content) {
      if (content.type === "tool-call") {
        processToolCall(content, parts, toolResults);
      } else if (content.type === "tool-result") {
        processToolResult(content, parts, toolResults);
      }
    }
  }

  return { parts, toolResults };
}

async function generateSuggestions(
  contextForLLM: Awaited<
    ReturnType<typeof createCoreChatAgent>
  >["contextForLLM"],
  responseMessages: Awaited<
    Awaited<ReturnType<typeof createCoreChatAgent>>["result"]["response"]
  >["messages"]
): Promise<string[]> {
  const followupSuggestionsResult = generateFollowupSuggestions([
    ...contextForLLM,
    ...responseMessages,
  ]);

  const result = await followupSuggestionsResult;
  let lastSuggestions: string[] = [];
  for await (const chunk of result.partialOutputStream) {
    if (chunk.suggestions) {
      lastSuggestions = chunk.suggestions.filter(
        (s: string | undefined): s is string => s !== undefined
      );
    }
  }

  return lastSuggestions.length > 0 ? lastSuggestions.slice(-5) : [];
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
  const explicitlyRequestedTools =
    determineExplicitlyRequestedTools(selectedTool) ?? activeTools;

  const { result, contextForLLM, output, response } =
    await executeAgentAndGetOutput({
      userMessage,
      previousMessages,
      selectedModelId,
      explicitlyRequestedTools,
      userId,
      abortSignal,
      messageId,
    });

  const steps = (await result.steps) ?? [];
  const { parts, toolResults } = extractToolCallsAndResults(steps);

  if (output) {
    parts.unshift({
      type: "text",
      text: output,
    });
  }

  const assistantMessage: ChatMessage = {
    id: messageId,
    role: "assistant",
    parts,
    metadata: {
      createdAt: new Date(),
      parentMessageId: userMessage.id,
      selectedModel: selectedModelId,
      activeStreamId: null,
    },
  };

  const followupSuggestions = await generateSuggestions(
    contextForLLM,
    response.messages
  );
  const usage = await result.usage;

  return {
    finalText: output,
    assistantMessage,
    usage,
    toolResults,
    followupSuggestions,
  };
}
