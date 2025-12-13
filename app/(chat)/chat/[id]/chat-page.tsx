"use client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";
import { ChatSystem } from "@/components/chat-system";
import {
  useGetChatByIdQueryOptions,
  useGetChatMessagesQueryOptions,
} from "@/hooks/chat-sync-hooks";
import { useChatSystemInitialState } from "@/hooks/use-chat-system-initial-state";
import { useChatId } from "@/providers/chat-id-provider";
import { useSession } from "@/providers/session-provider";

function ChatPageContent({ chatId }: { chatId: string }) {
  const getChatByIdQueryOptions = useGetChatByIdQueryOptions(chatId);
  const { data: chat } = useSuspenseQuery(getChatByIdQueryOptions);
  const getMessagesByChatIdQueryOptions = useGetChatMessagesQueryOptions();
  const { data: messages } = useSuspenseQuery(getMessagesByChatIdQueryOptions);

  const { initialMessages, initialTool } = useChatSystemInitialState(messages);

  if (!chat) {
    return notFound();
  }

  return (
    <ChatSystem
      id={chat.id}
      initialMessages={initialMessages}
      initialTool={initialTool}
      isReadonly={false}
    />
  );
}

export function ChatPage() {
  const { id, isPersisted } = useChatId();
  const { data: session, isPending } = useSession();

  // Anonymous users can't access persisted chat pages
  if (isPersisted && !isPending && !session?.user) {
    redirect("/");
  }

  if (!isPersisted) {
    return notFound();
  }

  return <ChatPageContent chatId={id} />;
}
