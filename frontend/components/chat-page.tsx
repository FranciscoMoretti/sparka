'use client';
import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { getDefaultThread } from '@/lib/thread-utils';
import { useGetChatById, useMessagesQuery } from '@/hooks/use-chat-store';
import { useMemo } from 'react';
import { WithSkeleton } from '@/components/ui/skeleton';
import { notFound } from 'next/navigation';
import { ChatInputProvider } from '@/providers/chat-input-provider';
import { useChatId } from '@/providers/chat-id-provider';

export function ChatPage() {
  const { chatId: id } = useChatId();

  const { data: chat, isLoading: isChatLoading } = useGetChatById(id || '');
  const { data: messages, isLoading: isMessagesLoading } = useMessagesQuery();

  // Get messages if chat exists

  const initialThreadMessages = useMemo(() => {
    if (!messages) return [];
    return getDefaultThread(
      messages.map((msg) => ({ ...msg, id: msg.id.toString() })),
    );
  }, [messages]);

  if ((!isChatLoading && !chat) || !id) {
    return notFound();
  }

  // Chat exists in DB - handle visibility and permissions
  // Note: In client-side rendering, we don't have server-side session
  // This would need to be adapted based on your auth strategy
  // TODO: Chat sharing should be implemented with other strategy

  if (isMessagesLoading || isChatLoading) {
    return (
      <WithSkeleton
        isLoading={isChatLoading || isMessagesLoading}
        className="w-full h-full"
      >
        <div className="flex h-screen w-full" />
      </WithSkeleton>
    );
  }

  return (
    <>
      <WithSkeleton
        isLoading={isChatLoading || isMessagesLoading}
        className="w-full"
      >
        <ChatInputProvider localStorageEnabled={true}>
          <Chat
            key={id}
            id={id}
            initialMessages={initialThreadMessages}
            isReadonly={false} // You'll need to implement proper auth check here
          />
        </ChatInputProvider>
      </WithSkeleton>
      <DataStreamHandler id={id} />
    </>
  );
}
