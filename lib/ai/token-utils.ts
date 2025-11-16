import type { ModelMessage } from "ai";
import { getEncoding } from "js-tiktoken";
import { RecursiveCharacterTextSplitter } from "./text-splitter";

const MinChunkSize = 140;
const encoder = getEncoding("o200k_base");

// Calculate total tokens from messages
export function calculateMessagesTokens(messages: ModelMessage[]): number {
  let totalTokens = 0;

  for (const message of messages) {
    // Count tokens for role
    totalTokens += encoder.encode(message.role).length;

    // Count tokens for content - handle both string and array formats
    if (typeof message.content === "string") {
      totalTokens += encoder.encode(message.content).length;
    } else if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === "text") {
          totalTokens += encoder.encode(part.text).length;
        }
        // Add overhead for other part types (image, file, etc.)
        // Using GPT-4V approximation: ~765 tokens for typical image
        else {
          totalTokens += 765;
        }
      }
    }

    // Add overhead for message structure (role, content wrapper, etc.)
    totalTokens += 5;
  }

  return totalTokens;
}

// trim prompt to maximum context size
export function trimPrompt(prompt: string, contextSize: number) {
  if (!prompt) {
    return "";
  }

  const length = encoder.encode(prompt).length;
  if (length <= contextSize) {
    return prompt;
  }

  const overflowTokens = length - contextSize;
  // on average it's 3 characters per token, so multiply by 3 to get a rough estimate of the number of characters
  const chunkSize = prompt.length - overflowTokens * 3;
  if (chunkSize < MinChunkSize) {
    return prompt.slice(0, MinChunkSize);
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap: 0,
  });
  const trimmedPrompt = splitter.splitText(prompt)[0] ?? "";

  // last catch, there's a chance that the trimmed prompt is same length as the original prompt, due to how tokens are split & innerworkings of the splitter, handle this case by just doing a hard cut
  if (trimmedPrompt.length === prompt.length) {
    return trimPrompt(prompt.slice(0, chunkSize), contextSize);
  }

  // recursively trim until the prompt is within the context size
  return trimPrompt(trimmedPrompt, contextSize);
}

// Helper function to truncate a string message to fit available tokens
function truncateStringMessage(
  message: ModelMessage,
  availableTokens: number
): ModelMessage {
  if (typeof message.content !== "string") {
    return message;
  }

  return {
    ...message,
    content: trimPrompt(message.content, availableTokens),
  };
}

// Helper function to truncate a tool message with array content
function truncateToolMessage(
  message: ModelMessage,
  availableTokens: number
): ModelMessage {
  if (!Array.isArray(message.content)) {
    return message;
  }

  const content = [...message.content];
  const currentMessageTokens = calculateMessagesTokens([message]);
  let tokensToRemove = currentMessageTokens - availableTokens;

  // Truncate from the end of the content array
  for (let i = content.length - 1; i >= 0 && tokensToRemove > 0; i--) {
    const part = content[i];
    const isToolResult =
      part.type === "tool-result" &&
      part.output &&
      typeof part.output === "object" &&
      "value" in part.output &&
      typeof part.output.value === "string";

    if (isToolResult) {
      const partTokens = encoder.encode(part.output.value).length;
      if (partTokens > 0) {
        // Truncate this part's output value
        const targetTokens = Math.max(0, partTokens - tokensToRemove);
        content[i] = {
          ...part,
          output: {
            type: "text" as const,
            value: trimPrompt(part.output.value, targetTokens),
          },
        };
        tokensToRemove -= partTokens - targetTokens;
      } else {
        // Remove entire part if needed
        content.splice(i, 1);
        tokensToRemove -= partTokens;
      }
    }
  }

  return {
    ...message,
    content,
  } as ModelMessage;
}

// Helper function to truncate the last message in the array
function truncateLastMessage(
  message: ModelMessage,
  _currentTokens: number,
  availableTokens: number
): ModelMessage {
  const isStringMessage =
    typeof message.content === "string" && message.role !== "tool";
  const isToolMessage =
    Array.isArray(message.content) && message.role === "tool";

  if (isStringMessage) {
    return truncateStringMessage(message, availableTokens);
  }

  if (isToolMessage) {
    return truncateToolMessage(message, availableTokens);
  }

  return message;
}

// Handle case where available tokens are insufficient
function handleInsufficientTokens(
  systemMessage: ModelMessage | null,
  maxTokens: number
): ModelMessage[] | null {
  if (systemMessage && typeof systemMessage.content === "string") {
    return [
      {
        ...systemMessage,
        content: trimPrompt(systemMessage.content, maxTokens),
      },
    ];
  }
  return systemMessage ? [systemMessage] : [];
}

// Remove messages from beginning until we fit within available tokens
function removeMessagesUntilFit(
  messages: ModelMessage[],
  availableTokens: number
): ModelMessage[] {
  const truncatedMessages = [...messages];
  let currentTokens = calculateMessagesTokens(truncatedMessages);

  while (currentTokens > availableTokens && truncatedMessages.length > 0) {
    truncatedMessages.shift(); // Remove oldest message first
    currentTokens = calculateMessagesTokens(truncatedMessages);
  }

  return truncatedMessages;
}

// Truncate messages array to fit within token limit
export function truncateMessages(
  messages: ModelMessage[],
  maxTokens: number,
  preserveSystemMessage = true
): ModelMessage[] {
  if (messages.length === 0) {
    return messages;
  }

  // Always preserve system message if requested
  const systemMessage =
    preserveSystemMessage && messages[0]?.role === "system"
      ? messages[0]
      : null;
  const otherMessages = systemMessage ? messages.slice(1) : messages;

  // Calculate tokens for system message if it exists
  const systemTokens = systemMessage
    ? calculateMessagesTokens([systemMessage])
    : 0;
  const availableTokens = maxTokens - systemTokens;

  if (availableTokens <= 0) {
    const result = handleInsufficientTokens(systemMessage, maxTokens);
    return result || [];
  }

  // Start with all other messages and remove from the beginning until we fit
  const truncatedMessages = removeMessagesUntilFit(
    otherMessages,
    availableTokens
  );
  const currentTokens = calculateMessagesTokens(truncatedMessages);

  // If we still don't fit and have messages, truncate the content of the last message
  if (currentTokens > availableTokens && truncatedMessages.length > 0) {
    const lastMessage = truncatedMessages.at(-1);
    if (lastMessage) {
      truncatedMessages[truncatedMessages.length - 1] = truncateLastMessage(
        lastMessage,
        currentTokens,
        availableTokens
      );
    }
  }

  return systemMessage
    ? [systemMessage, ...truncatedMessages]
    : truncatedMessages;
}
