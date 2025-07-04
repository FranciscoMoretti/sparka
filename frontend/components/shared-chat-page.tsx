'use client';
import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { getDefaultThread } from '@/lib/thread-utils';
import { useMemo } from 'react';
import { WithSkeleton } from '@/components/ui/skeleton';
import { usePublicChat, usePublicChatMessages } from '@/hooks/use-shared-chat';
import { notFound } from 'next/navigation';
import { useChatId } from '@/providers/chat-id-provider';

export function SharedChatPage() {
  const { sharedChatId: id } = useChatId();
  const {
    data: chat,
    isLoading: isChatLoading,
    error: chatError,
  } = usePublicChat(id as string);
  const {
    data: messages,
    isLoading: isMessagesLoading,
    error: messagesError,
  } = usePublicChatMessages(id as string);

  const initialThreadMessages = useMemo(() => {
    if (!messages) return [];
    return getDefaultThread(
      messages.map((msg) => ({ ...msg, id: msg.id.toString() })),
    );
  }, [messages]);

  if (!id) {
    return notFound();
  }

  if (chatError || messagesError) {
    // TODO: Replace for error page
    return (
      <div className="flex items-center justify-center h-dvh">
        <div className="text-muted-foreground">
          This chat is not available or has been set to private
        </div>
      </div>
    );
  }

  if (!isChatLoading && !chat) {
    return notFound();
  }

  return (
    <>
      <WithSkeleton
        isLoading={isChatLoading || isMessagesLoading}
        className="w-full"
      >
        {/* // Shared chats don't need chat input provider */}
        <Chat
          id={id}
          initialMessages={initialThreadMessages}
          isReadonly={true}
        />
      </WithSkeleton>
      <DataStreamHandler id={id} />
    </>
  );
}
