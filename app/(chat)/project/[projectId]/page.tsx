import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { ProjectPage } from "./project-page";

export default async function ProjectPageRoute({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  // Prefetch project and its chats
  prefetch(trpc.project.getById.queryOptions({ id: projectId }));
  prefetch(trpc.chat.getAllChats.queryOptions({ projectId }));

  return (
    <HydrateClient>
      <ProjectPage />
    </HydrateClient>
  );
}
