import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { addExplicitToolRequestToMessages } from "@/app/(chat)/api/chat/add-explicit-tool-request-to-messages";
import { filterReasoningParts } from "@/app/(chat)/api/chat/filter-reasoning-parts";
import { getRecentGeneratedImage } from "@/app/(chat)/api/chat/get-recent-generated-image";
import { type AppModelId, getAppModelDefinition } from "@/lib/ai/app-models";
import { markdownJoinerTransform } from "@/lib/ai/markdown-joiner-transform";
import { getLanguageModel, getModelProviderOptions } from "@/lib/ai/providers";
import { getTools } from "@/lib/ai/tools/tools";
import type { ChatMessage, StreamWriter, ToolName } from "@/lib/ai/types";
import { replaceFilePartUrlByBinaryDataInMessages } from "@/lib/utils/download-assets";

export async function createCoreChatAgent({
  system,
  userMessage,
  previousMessages,
  selectedModelId,
  selectedTool,
  userId,
  activeTools,
  abortSignal,
  messageId,
  dataStream,
  onError,
}: {
  system: string;
  userMessage: ChatMessage;
  previousMessages: ChatMessage[];
  selectedModelId: AppModelId;
  selectedTool: ToolName | null;
  userId: string | null;
  activeTools: ToolName[];
  abortSignal?: AbortSignal;
  messageId: string;
  dataStream: StreamWriter;
  onError?: (error: unknown) => void;
}) {
  const modelDefinition = getAppModelDefinition(selectedModelId);

  // Build message thread
  const messages = [...previousMessages, userMessage].slice(-5);

  // Process conversation history
  const lastGeneratedImage = getRecentGeneratedImage(messages);

  let explicitlyRequestedTools: ToolName[] | null = null;
  if (selectedTool === "deepResearch") {
    explicitlyRequestedTools = ["deepResearch"];
  } else if (selectedTool === "webSearch") {
    explicitlyRequestedTools = ["webSearch"];
  } else if (selectedTool === "generateImage") {
    explicitlyRequestedTools = ["generateImage"];
  } else if (selectedTool === "createDocument") {
    explicitlyRequestedTools = ["createDocument", "updateDocument"];
  }

  addExplicitToolRequestToMessages(
    messages,
    activeTools,
    explicitlyRequestedTools
  );

  // Filter out reasoning parts to ensure compatibility between different models
  const messagesWithoutReasoning = filterReasoningParts(messages.slice(-5));

  // Convert to model messages
  const modelMessages = convertToModelMessages(messagesWithoutReasoning);

  // Replace file URLs with binary data
  const contextForLLM =
    await replaceFilePartUrlByBinaryDataInMessages(modelMessages);

  // Create the streamText result
  const result = streamText({
    model: getLanguageModel(modelDefinition.apiModelId),
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
    tools: getTools({
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
    }),
    onError,
    abortSignal,
    ...(modelDefinition.fixedTemperature
      ? {
          temperature: modelDefinition.fixedTemperature,
        }
      : {}),
    providerOptions: getModelProviderOptions(selectedModelId),
  });

  return {
    result,
    contextForLLM,
    modelDefinition,
  };
}
