export type ChatIdType = "chat" | "provisional";

export type ProvisionalChatId = {
  id: string;
  type: "provisional";
  /**
   * True when the current chatId is known to be persisted server-side (i.e. safe to query).
   * For provisional chats this is always false.
   */
  isPersisted: false;
};

export type PersistedChatId = {
  id: string;
  type: "chat";
  isPersisted: true;
};

export type ChatId = ProvisionalChatId | PersistedChatId;

const SHARE_ROUTE_PATTERN = /^\/share\/(.+)$/;
const PROJECT_ROUTE_PATTERN = /^\/project\/([^/]+)(?:\/chat\/(.+))?$/;
const CHAT_ROUTE_PATTERN = /^\/chat\/(.+)$/;

/**
 * Resolves the chat ID and type from a pathname.
 * Pure function - no side effects, easy to test.
 */
export function resolveChatId({
  pathname,
  provisionalId,
}: {
  pathname: string | null;
  provisionalId: string;
}): ChatId {
  // /share/:id → shared chat
  const shareMatch = pathname?.match(SHARE_ROUTE_PATTERN);
  if (shareMatch) {
    return {
      id: shareMatch[1],
      type: "chat",
      isPersisted: true,
    };
  }

  // /project/:projectId/chat/:chatId → chat
  // /project/:projectId → provisional
  const projectMatch = pathname?.match(PROJECT_ROUTE_PATTERN);
  if (projectMatch) {
    const chatId = projectMatch[2];
    if (chatId) {
      return {
        id: chatId,
        type: "chat",
        isPersisted: true,
      };
    }
    return {
      id: provisionalId,
      type: "provisional",
      isPersisted: false,
    };
  }

  // /chat/:id → chat
  const chatMatch = pathname?.match(CHAT_ROUTE_PATTERN);
  if (chatMatch) {
    const urlChatId = chatMatch[1];
    return {
      id: urlChatId,
      type: "chat",
      isPersisted: true,
    };
  }

  // / or anything else → provisional
  return {
    id: provisionalId,
    type: "provisional",
    isPersisted: false,
  };
}
