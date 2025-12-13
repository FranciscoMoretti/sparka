import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { ChatPage } from "./chat-page";

export default async function ChatPageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: chatId } = await params;

  // Prefetch the queries used in chat-page.tsx
  prefetch(trpc.chat.getChatById.queryOptions({ chatId }));
  prefetch(trpc.chat.getChatMessages.queryOptions({ chatId }));

  return (
    <HydrateClient>
      <Suspense>
        <ChatPage />
      </Suspense>
    </HydrateClient>
  );
}
