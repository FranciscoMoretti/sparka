import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { addExplicitToolRequestToMessages } from "@/app/(chat)/api/chat/add-explicit-tool-request-to-messages";
import { filterReasoningParts } from "@/app/(chat)/api/chat/filter-reasoning-parts";
import { getRecentGeneratedImage } from "@/app/(chat)/api/chat/get-recent-generated-image";
import { type AppModelId, getAppModelDefinition } from "@/lib/ai/app-models";
import { markdownJoinerTransform } from "@/lib/ai/markdown-joiner-transform";
import { getLanguageModel, getModelProviderOptions } from "@/lib/ai/providers";
import { getMcpTools, getTools } from "@/lib/ai/tools/tools";
import type { ChatMessage, StreamWriter, ToolName } from "@/lib/ai/types";
import type { McpConnector } from "@/lib/db/schema";
import { replaceFilePartUrlByBinaryDataInMessages } from "@/lib/utils/download-assets";
import { determineExplicitlyRequestedTools } from "./determine-explicitly-requested-tools";

export async function createCoreChatAgent({
  system,
  userMessage,
  previousMessages,
  selectedModelId,
  selectedTool,
  userId,
  budgetAllowedTools,
  abortSignal,
  messageId,
  dataStream,
  onError,
  mcpConnectors = [],
}: {
  system: string;
  userMessage: ChatMessage;
  previousMessages: ChatMessage[];
  selectedModelId: AppModelId;
  selectedTool: ToolName | null;
  userId: string | null;
  /** Budget-allowed base tools from route.ts (static ToolNames only) */
  budgetAllowedTools: ToolName[];
  abortSignal?: AbortSignal;
  messageId: string;
  dataStream: StreamWriter;
  onError?: (error: unknown) => void;
  mcpConnectors?: McpConnector[];
}) {
  const modelDefinition = await getAppModelDefinition(selectedModelId);

  // Build message thread
  const messages = [...previousMessages, userMessage].slice(-5);

  // Process conversation history
  const lastGeneratedImage = getRecentGeneratedImage(messages);

  const explicitlyRequestedTools =
    determineExplicitlyRequestedTools(selectedTool);

  addExplicitToolRequestToMessages(messages, explicitlyRequestedTools);

  // Filter out reasoning parts to ensure compatibility between different models
  const messagesWithoutReasoning = filterReasoningParts(messages.slice(-5));

  // Convert to model messages
  const modelMessages = convertToModelMessages(messagesWithoutReasoning);

  // Replace file URLs with binary data
  const contextForLLM =
    await replaceFilePartUrlByBinaryDataInMessages(modelMessages);

  // Get MCP tools if connectors are configured
  const { tools: mcpTools, cleanup: mcpCleanup } = await getMcpTools({
    connectors: mcpConnectors,
  });

  // Get base tools
  const baseTools = getTools({
    dataStream,
    session: {
      user: {
        id: userId || undefined,
      },
      expires: "noop",
    },
    contextForLLM,
    messageId,
    selectedModel: modelDefinition.apiModelId,
    attachments: userMessage.parts.filter((part) => part.type === "file"),
    lastGeneratedImage,
  });

  // Merge base tools with MCP tools
  const allTools = {
    ...baseTools,
    ...mcpTools,
  };

  // Compute final activeTools for streamText:
  // 1. Filter budget-allowed base tools to only those that actually exist in baseTools
  const existingBaseActiveTools = budgetAllowedTools.filter(
    (toolName) => toolName in baseTools
  );
  // 2. Always allow all MCP tools that exist at runtime
  const mcpToolNames = Object.keys(mcpTools);
  // 3. Build the final activeTools list (cast needed because MCP tools are dynamic)
  const activeTools = [
    ...new Set([...existingBaseActiveTools, ...mcpToolNames]),
  ] as (keyof typeof allTools)[];

  // Resolve async model config before streamText to ensure cleanup on failure
  let model: Awaited<ReturnType<typeof getLanguageModel>>;
  let providerOptions: Awaited<ReturnType<typeof getModelProviderOptions>>;
  try {
    [model, providerOptions] = await Promise.all([
      getLanguageModel(modelDefinition.apiModelId),
      getModelProviderOptions(selectedModelId),
    ]);
  } catch (error) {
    await mcpCleanup();
    throw error;
  }

  // Create the streamText result
  const result = streamText({
    model,
    system,
    messages: contextForLLM,
    stopWhen: [
      stepCountIs(5),
      ({ steps }) => {
        return steps.some((step) => {
          const toolResults = step.content;
          // Don't stop if the tool result is a clarifying question
          return toolResults.some(
            (toolResult) =>
              toolResult.type === "tool-result" &&
              toolResult.toolName === "deepResearch" &&
              (toolResult.output as { format?: string }).format === "report"
          );
        });
      },
    ],
    activeTools,
    experimental_transform: markdownJoinerTransform(),
    experimental_telemetry: {
      isEnabled: true,
      functionId: "chat-response",
    },
    tools: allTools,
    onError: (error) => {
      onError?.(error);
    },
    abortSignal,
    providerOptions,
    onFinish: async () => {
      // Clean up MCP clients when streaming is done (onFinish runs for both success and error)
      await mcpCleanup();
    },
  });

  return {
    result,
    contextForLLM,
    modelDefinition,
    mcpCleanup,
  };
}
