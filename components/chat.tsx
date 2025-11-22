"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import { useChatActions, useChatId, useChatStatus } from "@ai-sdk-tools/store";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { ChatHeader } from "@/components/chat-header";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useSidebar } from "@/components/ui/sidebar";
import { useArtifactSelector } from "@/hooks/use-artifact";
import type { ChatMessage } from "@/lib/ai/types";
import type { Session } from "@/lib/auth";
import type { Vote } from "@/lib/db/schema";
import { useMessageIds } from "@/lib/stores/hooks";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";
import { ArtifactPanel } from "./artifact-panel";
import { MessagesPane } from "./messages-pane";
import { ProjectHome } from "./project-home";

function MainPanel({
  chatId,
  hasMessages,
  isProjectPage,
  projectId,
  isReadonly,
  disableSuggestedActions,
  isArtifactVisible,
  status,
  votes,
  user,
  className,
}: {
  chatId: string;
  hasMessages: boolean;
  isProjectPage?: boolean;
  projectId?: string;
  isReadonly: boolean;
  disableSuggestedActions?: boolean;
  isArtifactVisible: boolean;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  user: Session["user"];
  className?: string;
}) {
  return (
    <div className={className}>
      <ChatHeader
        chatId={chatId}
        hasMessages={hasMessages}
        isReadonly={isReadonly}
        projectId={projectId}
        user={user}
      />

      {isProjectPage && !hasMessages && projectId ? (
        <ProjectHome chatId={chatId} projectId={projectId} status={status} />
      ) : (
        <MessagesPane
          chatId={chatId}
          className="bg-background"
          disableSuggestedActions={disableSuggestedActions}
          isReadonly={isReadonly}
          isVisible={!isArtifactVisible}
          status={status}
          votes={votes}
        />
      )}
    </div>
  );
}

export function Chat({
  id,
  initialMessages: _initialMessages,
  isReadonly,
  disableSuggestedActions,
  isProjectPage,
  projectId,
}: {
  id: string;
  initialMessages: ChatMessage[];
  isReadonly: boolean;
  disableSuggestedActions?: boolean;
  isProjectPage?: boolean;
  projectId?: string;
}) {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const isLoading = id !== useChatId();

  const messageIds = useMessageIds() as string[];
  const status = useChatStatus();
  const { stop } = useChatActions<ChatMessage>();
  const stopAsync: UseChatHelpers<ChatMessage>["stop"] = useCallback(
    async () => stop?.(),
    [stop]
  );
  // regenerate no longer needs to be drilled; components call the store directly

  const { data: votes } = useQuery({
    ...trpc.vote.getVotes.queryOptions({ chatId: id }),
    enabled:
      messageIds.length >= 2 && !isReadonly && !!session?.user && !isLoading,
  });

  const { state: sidebarState } = useSidebar();
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  return (
    <div
      className={cn(
        "@container flex h-dvh min-w-0 max-w-screen flex-col bg-background md:max-w-[calc(100vw-var(--sidebar-width))]",
        sidebarState === "collapsed" && "md:max-w-screen"
      )}
    >
      {/* Mobile: show either main or artifact using hidden/block, no resizable */}
      <MainPanel
        chatId={id}
        className={cn(
          "flex h-full min-w-0 flex-1 flex-col md:hidden",
          isArtifactVisible && "hidden",
          !isArtifactVisible && "flex"
        )}
        disableSuggestedActions={disableSuggestedActions}
        hasMessages={messageIds.length > 0}
        isArtifactVisible={isArtifactVisible}
        isProjectPage={isProjectPage}
        isReadonly={isReadonly}
        projectId={projectId}
        status={status}
        user={session?.user}
        votes={votes}
      />

      <ArtifactPanel
        chatId={id}
        className={cn(
          "flex h-full min-w-0 flex-1 flex-col md:hidden",
          !isArtifactVisible && "hidden",
          isArtifactVisible && "flex"
        )}
        isAuthenticated={!!session?.user}
        isReadonly={isReadonly}
        status={status}
        stop={stopAsync}
        votes={votes}
      />

      {/* Desktop: main full-width when artifact hidden */}
      {!isArtifactVisible && (
        <MainPanel
          chatId={id}
          className="hidden h-full min-w-0 flex-1 flex-col md:flex"
          disableSuggestedActions={disableSuggestedActions}
          hasMessages={messageIds.length > 0}
          isArtifactVisible={isArtifactVisible}
          isProjectPage={isProjectPage}
          isReadonly={isReadonly}
          projectId={projectId}
          status={status}
          user={session?.user}
          votes={votes}
        />
      )}

      {/* Desktop: resizable main + artifact when artifact visible */}
      {isArtifactVisible && (
        <ResizablePanelGroup
          className="hidden! md:flex! h-full w-full"
          direction="horizontal"
        >
          <ResizablePanel defaultSize={65} minSize={40}>
            <MainPanel
              chatId={id}
              className="flex h-full min-w-0 flex-1 flex-col"
              disableSuggestedActions={disableSuggestedActions}
              hasMessages={messageIds.length > 0}
              isArtifactVisible={isArtifactVisible}
              isProjectPage={isProjectPage}
              isReadonly={isReadonly}
              projectId={projectId}
              status={status}
              user={session?.user}
              votes={votes}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={35} minSize={25}>
            <ArtifactPanel
              chatId={id}
              className="flex h-full min-w-0 flex-1 flex-col"
              isAuthenticated={!!session?.user}
              isReadonly={isReadonly}
              status={status}
              stop={stopAsync}
              votes={votes}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}
