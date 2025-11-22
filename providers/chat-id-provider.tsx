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
  const chatIdParam =
    typeof params?.chatId === "string" ? params.chatId : undefined;
  const projectIdParam =
    typeof params?.projectId === "string" ? params.projectId : undefined;
  const idParam = typeof params?.id === "string" ? params.id : undefined;

  // Compute final id and type directly from pathname and state
  const { id, type } = useMemo<ChatId>(() => {
    const isShareRoute = pathname?.startsWith("/share/");
    const sharedChatId = isShareRoute && idParam ? idParam : null;
    if (sharedChatId) {
      return {
        id: sharedChatId,
        type: "shared" as const,
      };
    }

    if (chatIdParam) {
      return {
        id: chatIdParam,
        type: "chat" as const,
      };
    }

    if (projectIdParam && !chatIdParam) {
      return {
        id: provisionalChatIdRef.current,
        type: "provisional" as const,
      };
    }

    if (pathname === "/") {
      return {
        id: provisionalChatIdRef.current,
        type: "provisional" as const,
      };
    }

    const urlChatId =
      idParam ??
      (pathname?.startsWith("/chat/") ? pathname.replace("/chat/", "") : "");
    if (urlChatId === provisionalChatIdRef.current) {
      provisionalChatIdRef.current = generateUUID();
      return {
        id: urlChatId,
        type: "provisional" as const,
      };
    }

    if (urlChatId) {
      return {
        id: urlChatId,
        type: "chat" as const,
      };
    }

    return {
      id: provisionalChatIdRef.current,
      type: "provisional" as const,
    };
  }, [chatIdParam, idParam, pathname, projectIdParam]);

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
