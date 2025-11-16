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
  getMessageById,
  getProjectById,
  getUserById,
  saveChat,
  saveMessage,
  updateMessage,
} from "@/lib/db/queries";
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

async function handleAuthenticatedUserDatabase({
  chatId,
  userMessage,
  userId,
  projectId,
  log,
}: {
  chatId: string;
  userMessage: ChatMessage;
  userId: string;
  projectId: string | undefined;
  log: any;
}) {
  const chat = await getChatById({ id: chatId });

  if (chat && chat.userId !== userId) {
    log.warn("Unauthorized - chat ownership mismatch");
    return { error: "Unauthorized" };
  }

  if (!chat) {
    const title = await generateTitleFromUserMessage({
      message: userMessage,
    });

    await saveChat({ id: chatId, userId, title, projectId });
  }

  const [exsistentMessage] = await getMessageById({ id: userMessage.id });

  if (exsistentMessage && exsistentMessage.chatId !== chatId) {
    log.warn("Unauthorized - message chatId mismatch");
    return { error: "Unauthorized" };
  }

  if (!exsistentMessage) {
    // If the message does not exist, save it
    await saveMessage({
      id: userMessage.id,
      chatId,
      message: userMessage,
    });
  }

  return { error: null };
}

async function validateRequestData(request: NextRequest) {
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

  return { chatId, userMessage, anonymousPreviousMessages, projectId };
}

async function handleAnonymousUserSetup(
  request: NextRequest,
  selectedModelId: AppModelId,
  baseModelCost: number,
  log: any
): Promise<{
  anonymousSession: AnonymousSession | null;
  rateLimitResult: any;
}> {
  const clientIP = getClientIP(request);
  const rateLimitResult = await checkAnonymousRateLimit(
    clientIP,
    redisPublisher
  );

  if (!rateLimitResult.success) {
    log.warn({ clientIP }, "Rate limit exceeded");
    return {
      anonymousSession: null,
      rateLimitResult: {
        ...rateLimitResult,
        error: JSON.stringify({
          error: rateLimitResult.error,
          type: "RATE_LIMIT_EXCEEDED",
        }),
      },
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
      anonymousSession: null,
      rateLimitResult: {
        ...rateLimitResult,
        error: JSON.stringify({
          error: `You've used all ${ANONYMOUS_LIMITS.CREDITS} free messages. Sign up to continue chatting with unlimited access!`,
          type: "ANONYMOUS_LIMIT_EXCEEDED",
          maxMessages: ANONYMOUS_LIMITS.CREDITS,
          suggestion:
            "Create an account to get unlimited messages and access to more AI models",
        }),
      },
    };
  }

  // Validate model for anonymous users
  if (!ANONYMOUS_LIMITS.AVAILABLE_MODELS.includes(selectedModelId as any)) {
    log.warn("Model not available for anonymous users");
    return {
      anonymousSession: null,
      rateLimitResult: {
        ...rateLimitResult,
        error: JSON.stringify({
          error: "Model not available for anonymous users",
          availableModels: ANONYMOUS_LIMITS.AVAILABLE_MODELS,
        }),
      },
    };
  }

  anonymousSession.remainingCredits -= baseModelCost;
  await setAnonymousSession(anonymousSession);

  return { anonymousSession, rateLimitResult };
}

async function getMessageThread(
  isAnonymous: boolean,
  chatId: string,
  anonymousPreviousMessages: ChatMessage[],
  parentMessageId: string | undefined
): Promise<ChatMessage[]> {
  if (isAnonymous) {
    return anonymousPreviousMessages;
  }
  return await getThreadUpToMessageId(chatId, parentMessageId);
}

function getErrorStatusCode(errorMessage: string): number {
  if (errorMessage.includes("ANONYMOUS_LIMIT_EXCEEDED")) {
    return 402;
  }
  if (errorMessage.includes("not available")) {
    return 403;
  }
  return 429;
}

function getModelDefinition(
  selectedModelId: AppModelId,
  log: any
): AppModelDefinition | Response {
  try {
    return getAppModelDefinition(selectedModelId);
  } catch (_error) {
    log.warn("Model not found");
    return new Response("Model not found", { status: 404 });
  }
}

function validateInputTokens(
  userMessage: ChatMessage,
  log: any
): { valid: true } | { valid: false; errorResponse: Response } {
  const totalTokens = calculateMessagesTokens(
    convertToModelMessages([userMessage])
  );

  if (totalTokens > MAX_INPUT_TOKENS) {
    log.warn({ totalTokens, MAX_INPUT_TOKENS }, "Token limit exceeded");
    const error = new ChatSDKError(
      "input_too_long:chat",
      `Message too long: ${totalTokens} tokens (max: ${MAX_INPUT_TOKENS})`
    );
    return { valid: false, errorResponse: error.toResponse() };
  }

  return { valid: true };
}

async function initializeChatRequest({
  request,
  chatId,
  userMessage,
  selectedModelId,
  anonymousPreviousMessages,
  projectId,
  isAnonymous,
  userId,
  log,
}: {
  request: NextRequest;
  chatId: string;
  userMessage: ChatMessage;
  selectedModelId: AppModelId;
  anonymousPreviousMessages: ChatMessage[];
  projectId: string | undefined;
  isAnonymous: boolean;
  userId: string | null;
  log: any;
}): Promise<
  | {
      success: false;
      errorResponse: Response;
    }
  | {
      success: true;
      anonymousSession: AnonymousSession | null;
      modelDefinition: AppModelDefinition;
      selectedTool: string | null;
      explicitlyRequestedTools: ToolName[] | null;
      baseModelCost: number;
      reservation: CreditReservation | null;
      activeTools: ToolName[];
      messageThreadToParent: ChatMessage[];
      previousMessages: ChatMessage[];
    }
> {
  // Validate authenticated user
  if (userId) {
    const user = await getUserById({ userId });
    if (!user) {
      log.warn("User not found");
      return {
        success: false,
        errorResponse: new Response("User not found", { status: 404 }),
      };
    }
  }

  const baseModelCost = getBaseModelCostByModelId(selectedModelId);

  // Handle anonymous user setup
  let anonymousSession: AnonymousSession | null = null;
  if (isAnonymous) {
    const { anonymousSession: session, rateLimitResult } =
      await handleAnonymousUserSetup(
        request,
        selectedModelId,
        baseModelCost,
        log
      );

    if (!session) {
      const status = getErrorStatusCode(rateLimitResult.error);
      return {
        success: false,
        errorResponse: new Response(rateLimitResult.error, {
          status,
          headers: {
            "Content-Type": "application/json",
            ...(rateLimitResult.headers || {}),
          },
        }),
      };
    }
    anonymousSession = session;
  }

  // Extract selectedTool from user message metadata
  const selectedTool = userMessage.metadata.selectedTool || null;
  log.debug({ selectedTool }, "selectedTool");

  const modelDef = getModelDefinition(selectedModelId, log);
  if (modelDef instanceof Response) {
    return {
      success: false,
      errorResponse: modelDef,
    };
  }
  const modelDefinition = modelDef;

  // Handle database operations for authenticated users
  if (!isAnonymous) {
    const { error: dbError } = await handleAuthenticatedUserDatabase({
      chatId,
      userMessage,
      userId,
      projectId,
      log,
    });
    if (dbError) {
      return {
        success: false,
        errorResponse: new Response(dbError, { status: 401 }),
      };
    }
  }

  const explicitlyRequestedTools = getExplicitlyRequestedTools(selectedTool);

  // Handle credit reservation
  const { reservation, error: reservationError } =
    await handleCreditReservation({
      isAnonymous,
      userId,
      baseModelCost,
      anonymousSession,
      log,
    });

  if (reservationError) {
    return {
      success: false,
      errorResponse: new Response(reservationError, { status: 402 }),
    };
  }

  // Setup active tools
  const { activeTools, error: toolsError } = setupActiveTools({
    isAnonymous,
    baseModelCost,
    explicitlyRequestedTools,
    modelDefinition,
    reservation,
    log,
  });

  if (toolsError) {
    return {
      success: false,
      errorResponse: new Response(toolsError, { status: 402 }),
    };
  }

  // Validate input token limit
  const tokenValidation = validateInputTokens(userMessage, log);
  if (!tokenValidation.valid) {
    return {
      success: false,
      errorResponse: tokenValidation.errorResponse,
    };
  }

  const messageThreadToParent = await getMessageThread(
    isAnonymous,
    chatId,
    anonymousPreviousMessages,
    userMessage.metadata.parentMessageId
  );

  const previousMessages = messageThreadToParent.slice(-5);

  return {
    success: true,
    anonymousSession,
    modelDefinition,
    selectedTool,
    explicitlyRequestedTools,
    baseModelCost,
    reservation,
    activeTools,
    messageThreadToParent,
    previousMessages,
  };
}

function getExplicitlyRequestedTools(
  selectedTool: string | null
): ToolName[] | null {
  if (selectedTool === "deepResearch") {
    return ["deepResearch"];
  }
  if (selectedTool === "webSearch") {
    return ["webSearch"];
  }
  if (selectedTool === "generateImage") {
    return ["generateImage"];
  }
  if (selectedTool === "createDocument") {
    return ["createDocument", "updateDocument"];
  }
  return null;
}

async function handleCreditReservation({
  isAnonymous,
  userId,
  baseModelCost,
  anonymousSession,
  log,
}: {
  isAnonymous: boolean;
  userId: string | null;
  baseModelCost: number;
  anonymousSession: AnonymousSession | null;
  log: any;
}): Promise<{ reservation: CreditReservation | null; error: string | null }> {
  let reservation: CreditReservation | null = null;

  if (!isAnonymous) {
    const { reservation: res, error: creditError } = await getCreditReservation(
      userId,
      baseModelCost
    );

    if (creditError) {
      log.error(
        "RESPONSE > POST /api/chat: Credit reservation error:",
        creditError
      );
      return { reservation: null, error: creditError };
    }

    reservation = res;
  } else if (anonymousSession) {
    anonymousSession.remainingCredits -= baseModelCost;
    await setAnonymousSession(anonymousSession);
  }

  return { reservation, error: null };
}

async function createAndReturnStream({
  isAnonymous,
  chatId,
  messageId,
  streamId,
  userId,
  userMessage,
  previousMessages,
  selectedModelId,
  selectedTool,
  activeTools,
  reservation,
  baseModelCost,
  anonymousSession,
  timeoutId,
  log,
  abortController,
}: {
  isAnonymous: boolean;
  chatId: string;
  messageId: string;
  streamId: string;
  userId: string | null;
  userMessage: ChatMessage;
  previousMessages: ChatMessage[];
  selectedModelId: AppModelId;
  selectedTool: string | null;
  activeTools: ToolName[];
  reservation: CreditReservation | null;
  baseModelCost: number;
  anonymousSession: AnonymousSession | null;
  timeoutId: NodeJS.Timeout;
  log: any;
  abortController: AbortController;
}) {
  // Save placeholder assistant message for authenticated users
  if (!isAnonymous) {
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

  const system_prompt = await getSystemPrompt({ isAnonymous, chatId });

  // Build the data stream that will emit tokens
  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer: dataStream }) => {
      const { result, contextForLLM } = await createCoreChatAgent({
        system: system_prompt,
        userMessage,
        previousMessages,
        selectedModelId,
        selectedTool,
        userId,
        activeTools,
        abortSignal: abortController.signal,
        messageId,
        dataStream,
        onError: (error) => {
          log.error({ error }, "streamText error");
        },
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
    onFinish: async ({ messages, isContinuation: _isContinuation }) => {
      // Clear timeout since we finished successfully
      clearTimeout(timeoutId);

      await handleChatFinish({
        messages,
        userId,
        isAnonymous,
        baseModelCost,
        reservation,
        chatId,
        log,
      });
    },

    onError: (error) => {
      // Clear timeout on error
      clearTimeout(timeoutId);
      log.error({ error }, "onError");
      // Release reserved credits on error (fire and forget)
      if (reservation) {
        reservation.cleanup();
      }
      if (anonymousSession) {
        anonymousSession.remainingCredits += baseModelCost;
        setAnonymousSession(anonymousSession);
      }
      return "Oops, an error occured!";
    },
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

function setupActiveTools({
  isAnonymous,
  baseModelCost,
  explicitlyRequestedTools,
  modelDefinition,
  reservation,
  log,
}: {
  isAnonymous: boolean;
  baseModelCost: number;
  explicitlyRequestedTools: ToolName[] | null;
  modelDefinition: AppModelDefinition;
  reservation: CreditReservation | null;
  log: any;
}): { activeTools: ToolName[]; error: string | null } {
  let availableBudget: number;
  if (isAnonymous) {
    availableBudget = ANONYMOUS_LIMITS.CREDITS;
  } else if (reservation) {
    availableBudget = reservation.budget - baseModelCost;
  } else {
    availableBudget = 0;
  }

  let activeTools: ToolName[] = filterAffordableTools(
    isAnonymous ? ANONYMOUS_LIMITS.AVAILABLE_TOOLS : allTools,
    availableBudget
  );

  // Disable all tools for models with unspecified features
  if (modelDefinition?.input) {
    // Let's not allow deepResearch if the model support reasoning (it's expensive and slow)
    if (
      modelDefinition.reasoning &&
      activeTools.some((tool: ToolName) => tool === "deepResearch")
    ) {
      activeTools = activeTools.filter(
        (tool: ToolName) => tool !== "deepResearch"
      );
    }
  } else {
    activeTools = [];
  }

  if (
    explicitlyRequestedTools &&
    explicitlyRequestedTools.length > 0 &&
    !activeTools.some((tool: ToolName) =>
      explicitlyRequestedTools.includes(tool)
    )
  ) {
    log.warn(
      { explicitlyRequestedTools },
      "Insufficient budget for requested tool"
    );
    return {
      activeTools: [],
      error: `Insufficient budget for requested tool: ${explicitlyRequestedTools}.`,
    };
  }

  if (explicitlyRequestedTools && explicitlyRequestedTools.length > 0) {
    log.debug(
      { explicitlyRequestedTools },
      "Setting explicitly requested tools"
    );
    activeTools = explicitlyRequestedTools;
  }

  return { activeTools, error: null };
}

async function handleChatFinish({
  messages,
  userId,
  isAnonymous,
  baseModelCost,
  reservation,
  chatId,
  log,
}: {
  messages: any[];
  userId: string | null;
  isAnonymous: boolean;
  baseModelCost: number;
  reservation: CreditReservation | null;
  chatId: string;
  log: any;
}) {
  // Clear timeout since we finished successfully
  // clearTimeout is handled by the caller

  if (userId) {
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
      // TODO: Validate if this is correct ai sdk v5
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
}

export async function POST(request: NextRequest) {
  const log = createModuleLogger("api:chat");
  try {
    const { chatId, userMessage, anonymousPreviousMessages, projectId } =
      await validateRequestData(request);

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

    const session = await auth.api.getSession({ headers: await headers() });

    const userId = session?.user?.id || null;
    const isAnonymous = userId === null;

    // Initialize and validate chat request
    const initResult = await initializeChatRequest({
      request,
      chatId,
      userMessage,
      selectedModelId,
      anonymousPreviousMessages,
      projectId,
      isAnonymous,
      userId,
      log,
    });

    if (!initResult.success) {
      return initResult.errorResponse;
    }

    const {
      anonymousSession,
      selectedTool,
      baseModelCost,
      reservation,
      activeTools,
      previousMessages,
    } = initResult;

    log.debug({ activeTools }, "active tools");

    // Create AbortController with 55s timeout for credit cleanup
    const abortController = new AbortController();
    const timeoutId = setTimeout(async () => {
      if (reservation) {
        await reservation.cleanup();
      }
      abortController.abort();
    }, 290_000); // 290 seconds

    // Ensure cleanup on any unhandled errors
    try {
      const messageId = generateUUID();
      const streamId = generateUUID();

      // Record this new stream so we can resume later - use Redis for all users
      if (redisPublisher) {
        const keyPrefix = isAnonymous
          ? `sparka-ai:anonymous-stream:${chatId}:${streamId}`
          : `sparka-ai:stream:${chatId}:${streamId}`;

        await redisPublisher.setEx(
          keyPrefix,
          600, // 10 minutes TTL
          JSON.stringify({ chatId, streamId, createdAt: Date.now() })
        );
      }

      return await createAndReturnStream({
        isAnonymous,
        chatId,
        messageId,
        streamId,
        userId,
        userMessage,
        previousMessages,
        selectedModelId,
        selectedTool,
        activeTools,
        reservation,
        baseModelCost,
        anonymousSession,
        timeoutId,
        log,
        abortController,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      log.error({ error }, "error found in try block");
      if (reservation) {
        await reservation.cleanup();
      }
      if (anonymousSession) {
        anonymousSession.remainingCredits += baseModelCost;
        setAnonymousSession(anonymousSession);
      }
      throw error;
    }
  } catch (error) {
    log.error({ error }, "RESPONSE > POST /api/chat error");
    return new Response("An error occurred while processing your request!", {
      status: 404,
    });
  }
}

// DELETE moved to tRPC chat.deleteChat mutation
