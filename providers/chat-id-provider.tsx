"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { generateUUID } from "@/lib/utils";
import { resolveChatId } from "./resolve-chat-id";

type ChatIdContextType = {
  id: string;
  /**
   * True when the current chatId is known to be persisted server-side (i.e. safe to query).
   * For existing chats, this is true immediately. For provisional chats, this flips when the
   * server confirms it saved the first user message.
   */
  isPersisted: boolean;
  confirmChatId: (chatId: string) => void;
  refreshChatID: () => void;
};

const ChatIdContext = createContext<ChatIdContextType | undefined>(undefined);

export function ChatIdProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [provisionalChatId, setProvisionalChatId] = useState<string>(() =>
    generateUUID()
  );
  const [confirmedChatId, setConfirmedChatId] = useState<string | null>(null);

  const { id, isPersisted } = useMemo(() => {
    const fromPathname = resolveChatId({
      pathname,
      provisionalId: provisionalChatId,
    });

    /**
     * Precedence (no navigation, no router writes):
     * 1) If the URL already points at a chat (/chat/:id, /project/:p/chat/:id, /share/:id),
     *    that ID wins and is always persisted.
     * 2) Otherwise, if the server confirms a persisted chat id during the current interaction,
     *    use that as the active id (still without navigating).
     * 3) Otherwise, fall back to the provisional id (not persisted).
     */
    if (fromPathname.isPersisted) {
      return { id: fromPathname.id, isPersisted: true };
    }
    if (confirmedChatId) {
      return { id: confirmedChatId, isPersisted: true };
    }
    return {
      id: fromPathname.id,
      isPersisted: false,
    };
  }, [pathname, provisionalChatId, confirmedChatId]);

  const confirmChatId = useCallback((chatId: string) => {
    setConfirmedChatId(chatId);
  }, []);

  const refreshChatID = useCallback(() => {
    setProvisionalChatId(generateUUID());
    setConfirmedChatId(null);
  }, []);

  const value = useMemo(
    () => ({
      id,
      isPersisted,
      confirmChatId,
      refreshChatID,
    }),
    [id, isPersisted, confirmChatId, refreshChatID]
  );

  return (
    <ChatIdContext.Provider value={value}>{children}</ChatIdContext.Provider>
  );
}

export function useChatId() {
  const context = useContext(ChatIdContext);
  if (context === undefined) {
    throw new Error("useChatId must be used within a ChatIdProvider");
  }
  return context;
}
