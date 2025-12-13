import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
} from "ai";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import {
  type AppModelDefinition,
  type AppModelId,
  getAppModelDefinition,
} from "@/lib/ai/app-models";
import { createCoreChatAgent } from "@/lib/ai/core-chat-agent";
import { determineExplicitlyRequestedTools } from "@/lib/ai/determine-explicitly-requested-tools";
import { ChatSDKError } from "@/lib/ai/errors";
import {
  generateFollowupSuggestions,
  streamFollowupSuggestions,
} from "@/lib/ai/followup-suggestions";
import { systemPrompt } from "@/lib/ai/prompts";
import { calculateMessagesTokens } from "@/lib/ai/token-utils";
import { allTools, toolsDefinitions } from "@/lib/ai/tools/tools-definitions";
import type { ChatMessage, ToolName } from "@/lib/ai/types";
import {
  getAnonymousSession,
  setAnonymousSession,
} from "@/lib/anonymous-session-server";
import { auth } from "@/lib/auth";
import { createAnonymousSession } from "@/lib/create-anonymous-session";
import type { CreditReservation } from "@/lib/credits/credit-reservation";
import {
  filterAffordableTools,
  getBaseModelCostByModelId,
} from "@/lib/credits/credits-utils";
import {
  getChatById,
  getMcpConnectorsByUserId,
  getMessageById,
  getProjectById,
  getUserById,
  saveChat,
  saveMessage,
  updateMessage,
} from "@/lib/db/queries";
import type { McpConnector } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { MAX_INPUT_TOKENS } from "@/lib/limits/tokens";
import { createModuleLogger } from "@/lib/logger";
import type { AnonymousSession } from "@/lib/types/anonymous";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { generateUUID } from "@/lib/utils";
import { checkAnonymousRateLimit, getClientIP } from "@/lib/utils/rate-limit";
import { generateTitleFromUserMessage } from "../../actions";
import { getCreditReservation } from "./get-credit-reservation";
import { getThreadUpToMessageId } from "./get-thread-up-to-message-id";

// Create shared Redis clients for resumable stream and cleanup
let redisPublisher: any = null;
let redisSubscriber: any = null;

if (env.REDIS_URL) {
  (async () => {
    const redis = await import("redis");
    redisPublisher = redis.createClient({ url: env.REDIS_URL });
    redisSubscriber = redis.createClient({ url: env.REDIS_URL });
    await Promise.all([redisPublisher.connect(), redisSubscriber.connect()]);
  })();
}

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
        keyPrefix: "sparka-ai:resumable-stream",
        ...(redisPublisher && redisSubscriber
          ? {
              publisher: redisPublisher,
              subscriber: redisSubscriber,
            }
          : {}),
      });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        console.log(
          " > Resumable streams are disabled due to missing REDIS_URL"
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export function getRedisSubscriber() {
  return redisSubscriber;
}

export function getRedisPublisher() {
  return redisPublisher;
}

async function handleAnonymousSession({
  request,
  redis,
  selectedModelId,
}: {
  request: NextRequest;
  redis: any;
  selectedModelId: AppModelId;
}): Promise<{
  anonymousSession: AnonymousSession;
  error: Response | null;
}> {
  const log = createModuleLogger("api:chat:anonymous");

  // Apply rate limiting for anonymous users
  const clientIP = getClientIP(request);
  const rateLimitResult = await checkAnonymousRateLimit(clientIP, redis);

  if (!rateLimitResult.success) {
    log.warn({ clientIP }, "Rate limit exceeded");
    return {
      anonymousSession: null as any,
      error: new Response(
        JSON.stringify({
          error: rateLimitResult.error,
          type: "RATE_LIMIT_EXCEEDED",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            ...(rateLimitResult.headers || {}),
          },
        }
      ),
    };
  }

  let anonymousSession = await getAnonymousSession();
  if (!anonymousSession) {
    anonymousSession = await createAnonymousSession();
  }

  // Check message limits
  if (anonymousSession.remainingCredits <= 0) {
    log.info("Anonymous message limit reached");
    return {
      anonymousSession: null as any,
      error: new Response(
        JSON.stringify({
          error: `You've used all ${ANONYMOUS_LIMITS.CREDITS} free messages. Sign up to continue chatting with unlimited access!`,
          type: "ANONYMOUS_LIMIT_EXCEEDED",
          maxMessages: ANONYMOUS_LIMITS.CREDITS,
          suggestion:
            "Create an account to get unlimited messages and access to more AI models",
        }),
        {
          status: 402,
          headers: {
            "Content-Type": "application/json",
            ...(rateLimitResult.headers || {}),
          },
        }
      ),
    };
  }

  // Validate model for anonymous users
  if (!ANONYMOUS_LIMITS.AVAILABLE_MODELS.includes(selectedModelId as any)) {
    log.warn("Model not available for anonymous users");
    return {
      anonymousSession: null as any,
      error: new Response(
        JSON.stringify({
          error: "Model not available for anonymous users",
          availableModels: ANONYMOUS_LIMITS.AVAILABLE_MODELS,
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            ...(rateLimitResult.headers || {}),
          },
        }
      ),
    };
  }

  return { anonymousSession, error: null };
}

async function handleChatValidation({
  chatId,
  userId,
  userMessage,
  projectId,
}: {
  chatId: string;
  userId: string;
  userMessage: ChatMessage;
  projectId?: string;
}): Promise<Response | null> {
  const log = createModuleLogger("api:chat:validation");

  const chat = await getChatById({ id: chatId });

  if (chat) {
    if (chat.userId !== userId) {
      log.warn("Unauthorized - chat ownership mismatch");
      return new Response("Unauthorized", { status: 401 });
    }
  } else {
    const title = await generateTitleFromUserMessage({
      message: userMessage,
    });

    await saveChat({ id: chatId, userId, title, projectId });
  }

  const [existentMessage] = await getMessageById({ id: userMessage.id });

  if (existentMessage && existentMessage.chatId !== chatId) {
    log.warn("Unauthorized - message chatId mismatch");
    return new Response("Unauthorized", { status: 401 });
  }

  if (!existentMessage) {
    // If the message does not exist, save it
    await saveMessage({
      id: userMessage.id,
      chatId,
      message: userMessage,
    });
  }

  return null;
}

async function handleCreditReservation({
  userId,
  isAnonymous,
  baseModelCost,
  anonymousSession,
}: {
  userId: string | null;
  isAnonymous: boolean;
  baseModelCost: number;
  anonymousSession: AnonymousSession | null;
}): Promise<{
  reservation: CreditReservation | null;
  error: Response | null;
}> {
  if (!isAnonymous) {
    if (!userId) {
      return {
        reservation: null,
        error: new Response("User ID is required for authenticated users", {
          status: 401,
        }),
      };
    }

    const { reservation: res, error: creditError } = await getCreditReservation(
      userId,
      baseModelCost
    );

    if (creditError) {
      console.log(
        "RESPONSE > POST /api/chat: Credit reservation error:",
        creditError
      );
      return {
        reservation: null,
        error: new Response(creditError, {
          status: 402,
        }),
      };
    }

    return { reservation: res, error: null };
  }

  if (anonymousSession) {
    // Increment message count and update session
    anonymousSession.remainingCredits -= baseModelCost;
    await setAnonymousSession(anonymousSession);
  }

  return { reservation: null, error: null };
}

/**
 * Determines which built-in tools are allowed based on budget and model capabilities.
 * This is purely about pricing & model gating for static ToolNames.
 * MCP tools are handled separately in core-chat-agent.
 */
function determineBudgetAllowedTools({
  isAnonymous,
  reservation,
  baseModelCost,
  modelDefinition,
  explicitlyRequestedTools,
}: {
  isAnonymous: boolean;
  reservation: CreditReservation | null;
  baseModelCost: number;
  modelDefinition: AppModelDefinition;
  explicitlyRequestedTools: ToolName[] | null;
}): {
  budgetAllowedTools: ToolName[];
  error: Response | null;
} {
  const log = createModuleLogger("api:chat:tools");

  const availableBudget = isAnonymous
    ? ANONYMOUS_LIMITS.CREDITS
    : (reservation?.budget ?? baseModelCost);
  const remainingBudget = availableBudget - baseModelCost;

  let budgetAllowedTools: ToolName[] = filterAffordableTools(
    isAnonymous ? ANONYMOUS_LIMITS.AVAILABLE_TOOLS : allTools,
    remainingBudget
  );

  // Disable all tools for models with unspecified features
  if (modelDefinition?.input) {
    // Let's not allow deepResearch if the model support reasoning (it's expensive and slow)
    if (
      modelDefinition.reasoning &&
      budgetAllowedTools.some((tool: ToolName) => tool === "deepResearch")
    ) {
      budgetAllowedTools = budgetAllowedTools.filter(
        (tool: ToolName) => tool !== "deepResearch"
      );
    }
  } else {
    budgetAllowedTools = [];
  }

  if (
    explicitlyRequestedTools &&
    explicitlyRequestedTools.length > 0 &&
    !budgetAllowedTools.some((tool: ToolName) =>
      explicitlyRequestedTools.includes(tool)
    )
  ) {
    log.warn(
      { explicitlyRequestedTools },
      "Insufficient budget for requested tool"
    );
    return {
      budgetAllowedTools: [],
      error: new Response(
        `Insufficient budget for requested tool: ${explicitlyRequestedTools}.`,
        {
          status: 402,
        }
      ),
    };
  }

  if (explicitlyRequestedTools && explicitlyRequestedTools.length > 0) {
    log.debug(
      { explicitlyRequestedTools },
      "Setting explicitly requested tools"
    );
    budgetAllowedTools = explicitlyRequestedTools;
  }

  return { budgetAllowedTools, error: null };
}

async function setupStreamContext({
  chatId,
  streamId,
  isAnonymous,
  redis,
}: {
  chatId: string;
  streamId: string;
  isAnonymous: boolean;
  redis: any;
}): Promise<void> {
  // Record this new stream so we can resume later - use Redis for all users
  if (redis) {
    const keyPrefix = isAnonymous
      ? `sparka-ai:anonymous-stream:${chatId}:${streamId}`
      : `sparka-ai:stream:${chatId}:${streamId}`;

    await redis.setEx(
      keyPrefix,
      600, // 10 minutes TTL
      JSON.stringify({ chatId, streamId, createdAt: Date.now() })
    );
  }
}

async function getSystemPrompt({
  isAnonymous,
  chatId,
}: {
  isAnonymous: boolean;
  chatId: string;
}): Promise<string> {
  let system = systemPrompt();
  if (!isAnonymous) {
    const currentChat = await getChatById({ id: chatId });
    if (currentChat?.projectId) {
      const project = await getProjectById({ id: currentChat.projectId });
      if (project?.instructions) {
        system = `${system}\n\nProject instructions:\n${project.instructions}`;
      }
    }
  }
  return system;
}

async function createChatStream({
  messageId,
  chatId,
  userMessage,
  previousMessages,
  selectedModelId,
  selectedTool,
  userId,
  budgetAllowedTools,
  abortController,
  isAnonymous,
  baseModelCost,
  reservation,
  timeoutId,
  mcpConnectors,
}: {
  messageId: string;
  chatId: string;
  userMessage: ChatMessage;
  previousMessages: ChatMessage[];
  selectedModelId: AppModelId;
  selectedTool: string | null;
  userId: string | null;
  budgetAllowedTools: ToolName[];
  abortController: AbortController;
  isAnonymous: boolean;
  baseModelCost: number;
  reservation: CreditReservation | null;
  timeoutId: NodeJS.Timeout;
  mcpConnectors: McpConnector[];
}) {
  const log = createModuleLogger("api:chat:stream");
  const system = await getSystemPrompt({ isAnonymous, chatId });

  const narrowedSelectedTool: ToolName | null =
    selectedTool && selectedTool in toolsDefinitions
      ? (selectedTool as ToolName)
      : null;

  // Build the data stream that will emit tokens
  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer: dataStream }) => {
      // Confirm chat persistence ASAP (chat + user message are persisted before streaming begins)
      if (!isAnonymous) {
        dataStream.write({
          id: generateUUID(),
          type: "data-chatConfirmed",
          data: { chatId },
          transient: true,
        });
      }

      const { result, contextForLLM } = await createCoreChatAgent({
        system,
        userMessage,
        previousMessages,
        selectedModelId,
        selectedTool: narrowedSelectedTool,
        userId,
        budgetAllowedTools,
        abortSignal: abortController.signal,
        messageId,
        dataStream,
        onError: (error) => {
          log.error({ error }, "streamText error");
        },
        mcpConnectors,
      });

      const initialMetadata = {
        createdAt: new Date(),
        parentMessageId: userMessage.id,
        isPartial: false,
        selectedModel: selectedModelId,
      };

      dataStream.merge(
        result.toUIMessageStream({
          sendReasoning: true,
          messageMetadata: ({ part }) => {
            // send custom information to the client on start:
            if (part.type === "start") {
              return initialMetadata;
            }

            // when the message is finished, send additional information:
            if (part.type === "finish") {
              return {
                ...initialMetadata,
                isPartial: false,
                usage: part.totalUsage,
              };
            }
          },
        })
      );
      await result.consumeStream();

      const response = await result.response;
      const responseMessages = response.messages;

      // Generate and stream follow-up suggestions
      const followupSuggestionsResult = generateFollowupSuggestions([
        ...contextForLLM,
        ...responseMessages,
      ]);
      await streamFollowupSuggestions({
        followupSuggestionsResult,
        writer: dataStream,
      });
    },
    generateId: () => messageId,
    onFinish: async ({
      messages,
      isContinuation: _isContinuation,
      responseMessage: _responseMessage,
    }) => {
      clearTimeout(timeoutId);
      await finalizeMessageAndCredits({
        messages,
        baseModelCost,
        userId,
        isAnonymous,
        chatId,
        reservation,
      });
    },
    onError: () => {
      clearTimeout(timeoutId);
      log.error("onError");
      // Release reserved credits on error
      if (reservation) {
        reservation.cleanup().catch((error) => {
          log.error({ error }, "Failed to cleanup reservation in onError");
        });
      }
      return "Oops, an error occured!";
    },
  });

  return stream;
}

async function executeChatRequest({
  chatId,
  userMessage,
  previousMessages,
  selectedModelId,
  selectedTool,
  userId,
  isAnonymous,
  baseModelCost,
  budgetAllowedTools,
  reservation,
  abortController,
  timeoutId,
  mcpConnectors,
}: {
  chatId: string;
  userMessage: ChatMessage;
  previousMessages: ChatMessage[];
  selectedModelId: AppModelId;
  selectedTool: string | null;
  userId: string | null;
  isAnonymous: boolean;
  baseModelCost: number;
  budgetAllowedTools: ToolName[];
  reservation: CreditReservation | null;
  abortController: AbortController;
  timeoutId: NodeJS.Timeout;
  mcpConnectors: McpConnector[];
}): Promise<Response> {
  const log = createModuleLogger("api:chat:execute");
  const messageId = generateUUID();
  const streamId = generateUUID();

  await setupStreamContext({
    chatId,
    streamId,
    isAnonymous,
    redis: redisPublisher,
  });

  if (!isAnonymous) {
    // Save placeholder assistant message immediately (needed for document creation)
    await saveMessage({
      id: messageId,
      chatId,
      message: {
        id: messageId,
        role: "assistant",
        parts: [],
        metadata: {
          createdAt: new Date(),
          isPartial: true,
          parentMessageId: userMessage.id,
          selectedModel: selectedModelId,
          selectedTool: undefined,
        },
      },
    });
  }

  // Build the data stream that will emit tokens
  const stream = await createChatStream({
    messageId,
    chatId,
    userMessage,
    previousMessages,
    selectedModelId,
    selectedTool,
    userId,
    budgetAllowedTools,
    abortController,
    isAnonymous,
    baseModelCost,
    reservation,
    timeoutId,
    mcpConnectors,
  });

  after(async () => {
    // Cleanup to happen after the POST response is sent
    // Set TTL on Redis keys to auto-expire after 10 minutes
    if (redisPublisher) {
      try {
        const keyPattern = `sparka-ai:resumable-stream:rs:sentinel:${streamId}*`;
        const keys = await redisPublisher.keys(keyPattern);
        if (keys.length > 0) {
          // Set 5 minute expiration on all stream-related keys
          await Promise.all(
            keys.map((key: string) => redisPublisher.expire(key, 300))
          );
        }
      } catch (error) {
        log.error({ error }, "Failed to set TTL on stream keys");
      }
    }

    try {
      // Clean up stream info from Redis for all users
      if (redisPublisher) {
        const keyPrefix = isAnonymous
          ? `sparka-ai:anonymous-stream:${chatId}:${streamId}`
          : `sparka-ai:stream:${chatId}:${streamId}`;

        await redisPublisher.expire(keyPrefix, 300);
      }
    } catch (cleanupError) {
      log.error({ cleanupError }, "Failed to cleanup stream record");
    }
  });

  const streamContext = getStreamContext();

  if (streamContext) {
    log.debug("Returning resumable stream");
    return new Response(
      await streamContext.resumableStream(streamId, () =>
        stream.pipeThrough(new JsonToSseTransformStream())
      ),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }
    );
  }
  return new Response(stream.pipeThrough(new JsonToSseTransformStream()), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function validateAndSetupSession({
  request,
  userMessage,
  selectedModelId,
}: {
  request: NextRequest;
  userMessage: ChatMessage;
  selectedModelId: AppModelId;
}): Promise<{
  userId: string | null;
  isAnonymous: boolean;
  anonymousSession: AnonymousSession | null;
  modelDefinition: AppModelDefinition;
  error: Response | null;
}> {
  const log = createModuleLogger("api:chat:setup");

  const session = await auth.api.getSession({ headers: await headers() });

  const userId = session?.user?.id || null;
  const isAnonymous = userId === null;
  let anonymousSession: AnonymousSession | null = null;

  // Check for authenticated users
  if (userId) {
    // TODO: Consider if checking if user exists is really needed
    const user = await getUserById({ userId });
    if (!user) {
      log.warn("User not found");
      return {
        userId: null,
        isAnonymous: true,
        anonymousSession: null,
        modelDefinition: null as any,
        error: new Response("User not found", { status: 404 }),
      };
    }
  } else {
    const result = await handleAnonymousSession({
      request,
      redis: redisPublisher,
      selectedModelId,
    });

    if (result.error) {
      return {
        userId: null,
        isAnonymous: true,
        anonymousSession: null,
        modelDefinition: null as any,
        error: result.error,
      };
    }

    anonymousSession = result.anonymousSession;
  }

  // Extract selectedTool from user message metadata
  const selectedTool = userMessage.metadata.selectedTool || null;
  log.debug({ selectedTool }, "selectedTool");

  let modelDefinition: AppModelDefinition;
  try {
    modelDefinition = await getAppModelDefinition(selectedModelId);
  } catch (_error) {
    log.warn("Model not found");
    return {
      userId,
      isAnonymous,
      anonymousSession,
      modelDefinition: null as any,
      error: new Response("Model not found", { status: 404 }),
    };
  }

  return {
    userId,
    isAnonymous,
    anonymousSession,
    modelDefinition,
    error: null,
  };
}

async function prepareRequestContext({
  userMessage,
  chatId,
  isAnonymous,
  anonymousPreviousMessages,
  baseModelCost,
  modelDefinition,
  reservation,
  explicitlyRequestedTools,
}: {
  userMessage: ChatMessage;
  chatId: string;
  isAnonymous: boolean;
  anonymousPreviousMessages: ChatMessage[];
  baseModelCost: number;
  modelDefinition: AppModelDefinition;
  reservation: CreditReservation | null;
  explicitlyRequestedTools: ToolName[] | null;
}): Promise<{
  previousMessages: ChatMessage[];
  budgetAllowedTools: ToolName[];
  error: Response | null;
}> {
  const log = createModuleLogger("api:chat:prepare");

  const toolsResult = determineBudgetAllowedTools({
    isAnonymous,
    reservation,
    baseModelCost,
    modelDefinition,
    explicitlyRequestedTools,
  });

  if (toolsResult.error) {
    return {
      previousMessages: [],
      budgetAllowedTools: [],
      error: toolsResult.error,
    };
  }

  const budgetAllowedTools = toolsResult.budgetAllowedTools;

  // Validate input token limit (50k tokens for user message)
  const totalTokens = calculateMessagesTokens(
    convertToModelMessages([userMessage])
  );

  if (totalTokens > MAX_INPUT_TOKENS) {
    log.warn({ totalTokens, MAX_INPUT_TOKENS }, "Token limit exceeded");
    const error = new ChatSDKError(
      "input_too_long:chat",
      `Message too long: ${totalTokens} tokens (max: ${MAX_INPUT_TOKENS})`
    );
    return {
      previousMessages: [],
      budgetAllowedTools: [],
      error: error.toResponse(),
    };
  }

  const messageThreadToParent = isAnonymous
    ? anonymousPreviousMessages
    : await getThreadUpToMessageId(
        chatId,
        userMessage.metadata.parentMessageId
      );

  const previousMessages = messageThreadToParent.slice(-5);
  log.debug({ budgetAllowedTools }, "budget allowed tools");

  return { previousMessages, budgetAllowedTools, error: null };
}

async function finalizeMessageAndCredits({
  messages,
  baseModelCost,
  userId,
  isAnonymous,
  chatId,
  reservation,
}: {
  messages: ChatMessage[];
  baseModelCost: number;
  userId: string | null;
  isAnonymous: boolean;
  chatId: string;
  reservation: CreditReservation | null;
}): Promise<void> {
  const log = createModuleLogger("api:chat:finalize");

  if (!userId) {
    return;
  }

  const actualCost =
    baseModelCost +
    messages
      .flatMap((message) => message.parts)
      .reduce((acc, toolResult) => {
        if (!toolResult.type.startsWith("tool-")) {
          return acc;
        }

        const toolDef =
          toolsDefinitions[toolResult.type.replace("tool-", "") as ToolName];

        if (!toolDef) {
          return acc;
        }

        return acc + toolDef.cost;
      }, 0);

  try {
    const assistantMessage = messages.at(-1);

    if (!assistantMessage) {
      throw new Error("No assistant message found!");
    }

    if (!isAnonymous) {
      await updateMessage({
        id: assistantMessage.id,
        chatId,
        message: assistantMessage,
      });
    }

    // Finalize credit usage: deduct actual cost, release reservation
    if (reservation) {
      await reservation.finalize(actualCost);
    }
  } catch (error) {
    log.error({ error }, "Failed to save chat or finalize credits");
    // Still release the reservation on error
    if (reservation) {
      await reservation.cleanup();
    }
  }
}

async function handleRequestExecution({
  chatId,
  userMessage,
  previousMessages,
  selectedModelId,
  selectedTool,
  userId,
  isAnonymous,
  anonymousSession,
  baseModelCost,
  budgetAllowedTools,
  reservation,
  abortController,
  timeoutId,
  mcpConnectors,
}: {
  chatId: string;
  userMessage: ChatMessage;
  previousMessages: ChatMessage[];
  selectedModelId: AppModelId;
  selectedTool: string | null;
  userId: string | null;
  isAnonymous: boolean;
  anonymousSession: AnonymousSession | null;
  baseModelCost: number;
  budgetAllowedTools: ToolName[];
  reservation: CreditReservation | null;
  abortController: AbortController;
  timeoutId: NodeJS.Timeout;
  mcpConnectors: McpConnector[];
}): Promise<Response> {
  const log = createModuleLogger("api:chat:execute-wrapper");
  try {
    return await executeChatRequest({
      chatId,
      userMessage,
      previousMessages,
      selectedModelId,
      selectedTool,
      userId,
      isAnonymous,
      baseModelCost,
      budgetAllowedTools,
      reservation,
      abortController,
      timeoutId,
      mcpConnectors,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    log.error({ error }, "error found in try block");
    if (reservation) {
      await reservation.cleanup();
    }
    if (anonymousSession) {
      anonymousSession.remainingCredits += baseModelCost;
      await setAnonymousSession(anonymousSession);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const log = createModuleLogger("api:chat");
  try {
    const {
      id: chatId,
      message: userMessage,
      prevMessages: anonymousPreviousMessages,
      projectId,
    }: {
      id: string;
      message: ChatMessage;
      prevMessages: ChatMessage[];
      projectId?: string;
    } = await request.json();

    if (!userMessage) {
      log.warn("No user message found");
      return new ChatSDKError("bad_request:api").toResponse();
    }

    // Extract selectedModel from user message metadata
    const selectedModelId = userMessage.metadata?.selectedModel as AppModelId;

    if (!selectedModelId) {
      log.warn("No selectedModel in user message metadata");
      return new ChatSDKError("bad_request:api").toResponse();
    }

    const sessionSetup = await validateAndSetupSession({
      request,
      userMessage,
      selectedModelId,
    });

    if (sessionSetup.error) {
      return sessionSetup.error;
    }

    const { userId, isAnonymous, anonymousSession, modelDefinition } =
      sessionSetup;

    // Extract selectedTool from user message metadata
    const selectedTool = userMessage.metadata.selectedTool || null;
    // Skip database operations for anonymous users
    if (!isAnonymous) {
      if (!userId) {
        log.warn("User ID is required for authenticated users");
        return new Response("User ID is required for authenticated users", {
          status: 401,
        });
      }

      const validationError = await handleChatValidation({
        chatId,
        userId,
        userMessage,
        projectId,
      });

      if (validationError) {
        return validationError;
      }
    }

    const explicitlyRequestedTools =
      determineExplicitlyRequestedTools(selectedTool);

    const baseModelCost = await getBaseModelCostByModelId(selectedModelId);

    const creditResult = await handleCreditReservation({
      userId,
      isAnonymous,
      baseModelCost,
      anonymousSession,
    });

    if (creditResult.error) {
      return creditResult.error;
    }

    const reservation = creditResult.reservation;

    const contextResult = await prepareRequestContext({
      userMessage,
      chatId,
      isAnonymous,
      anonymousPreviousMessages,
      baseModelCost,
      modelDefinition,
      reservation,
      explicitlyRequestedTools,
    });

    if (contextResult.error) {
      return contextResult.error;
    }

    const { previousMessages, budgetAllowedTools } = contextResult;

    // Fetch MCP connectors for authenticated users
    const mcpConnectors: McpConnector[] =
      userId && !isAnonymous ? await getMcpConnectorsByUserId({ userId }) : [];

    // Create AbortController with 55s timeout for credit cleanup
    const abortController = new AbortController();
    const timeoutId = setTimeout(async () => {
      if (reservation) {
        await reservation.cleanup();
      }
      abortController.abort();
    }, 290_000); // 290 seconds

    // Ensure cleanup on any unhandled errors
    return await handleRequestExecution({
      chatId,
      userMessage,
      previousMessages,
      selectedModelId,
      selectedTool,
      userId,
      isAnonymous,
      anonymousSession,
      baseModelCost,
      budgetAllowedTools,
      reservation,
      abortController,
      timeoutId,
      mcpConnectors,
    });
  } catch (error) {
    log.error({ error }, "RESPONSE > POST /api/chat error");
    return new Response("Internal Server Error", {
      status: 500,
    });
  }
}

// DELETE moved to tRPC chat.deleteChat mutation
