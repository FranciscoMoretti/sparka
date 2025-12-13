import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { ProjectChatPage } from "./project-chat-page";

export default async function ProjectChatPageRoute({
  params,
}: {
  params: Promise<{ projectId: string; chatId: string }>;
}) {
  const { projectId, chatId } = await params;

  // Prefetch the queries used in project-chat-page.tsx
  prefetch(trpc.project.getById.queryOptions({ id: projectId }));
  prefetch(trpc.chat.getChatById.queryOptions({ chatId }));
  prefetch(trpc.chat.getChatMessages.queryOptions({ chatId }));

  return (
    <HydrateClient>
      <ProjectChatPage />
    </HydrateClient>
  );
}
