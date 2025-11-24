"use client";

import { useParams, usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import { generateUUID } from "@/lib/utils";

type ChatIdContextType = {
  id: string;
  type: "chat" | "provisional" | "shared";
  refreshChatID: () => void;
};

const ChatIdContext = createContext<ChatIdContextType | undefined>(undefined);

type ChatId = {
  id: string;
  type: "chat" | "provisional" | "shared";
};

export function ChatIdProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{
    id?: string;
    projectId?: string;
    chatId?: string;
  }>();
  const provisionalChatIdRef = useRef<string>(generateUUID());

  const path = pathname ?? "";
  const routeId = params.id;
  const projectId = params.projectId;
  const chatId = params.chatId;

  const { id, type } = useMemo<ChatId>(() => {
    if (path.startsWith("/share/") && routeId) {
      return { id: routeId, type: "shared" };
    }

    if (chatId) {
      return { id: chatId, type: "chat" };
    }

    if (routeId && path.startsWith("/chat/")) {
      return { id: routeId, type: "chat" };
    }

    if (projectId && !chatId) {
      return { id: provisionalChatIdRef.current, type: "provisional" };
    }

    if (path === "/") {
      return { id: provisionalChatIdRef.current, type: "provisional" };
    }

    if (routeId) {
      return { id: routeId, type: "chat" };
    }

    return { id: provisionalChatIdRef.current, type: "provisional" };
  }, [chatId, path, projectId, routeId]);

  const refreshChatID = useCallback(() => {
    provisionalChatIdRef.current = generateUUID();
  }, []);

  const value = useMemo(
    () => ({
      id,
      type,
      refreshChatID,
    }),
    [id, type, refreshChatID]
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
