"use client";
import { useQuery } from "@tanstack/react-query";
import { Share } from "lucide-react";
import { memo } from "react";
import { HeaderActions } from "@/components/header-actions";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useGetChatByIdQueryOptions } from "@/hooks/chat-sync-hooks";
import type { Session } from "@/lib/auth";
import { useChatId } from "@/providers/chat-id-provider";
import { useTRPC } from "@/trpc/react";
import { ShareButton } from "./share-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const DISABLED_PROJECT_ID = "00000000-0000-0000-0000-000000000000";

function getChatLabel(params: {
  privateChat: { title?: string } | undefined;
  publicChat: { title?: string } | undefined;
  isPrivateChatLoading: boolean;
  isPublicChatLoading: boolean;
  hasMessages: boolean;
}): string {
  const {
    privateChat,
    publicChat,
    isPrivateChatLoading,
    isPublicChatLoading,
    hasMessages,
  } = params;

  if (privateChat?.title) {
    return privateChat.title;
  }
  if (publicChat?.title) {
    return publicChat.title;
  }
  if (isPrivateChatLoading || isPublicChatLoading) {
    return "Loading chat…";
  }
  if (hasMessages) {
    return "Untitled chat";
  }
  return "New chat";
}

function getProjectLabel(
  resolvedProjectId: string | null,
  project: { name?: string } | undefined,
  isProjectLoading: boolean
): string | undefined {
  if (!resolvedProjectId) {
    return;
  }
  if (project?.name) {
    return project.name;
  }
  if (isProjectLoading) {
    return "Loading project…";
  }
}

function PureChatHeader({
  chatId,
  isReadonly,
  hasMessages,
  projectId,
  user,
}: {
  chatId: string;
  isReadonly: boolean;
  hasMessages: boolean;
  projectId?: string;
  user: Session["user"];
}) {
  const trpc = useTRPC();
  const { type } = useChatId();
  const isAuthenticated = !!user;

  const shouldFetchPrivateChat = isAuthenticated && type === "chat";
  const getChatByIdQueryOptions = useGetChatByIdQueryOptions(chatId);
  const { data: privateChat, isLoading: isPrivateChatLoading } = useQuery({
    ...getChatByIdQueryOptions,
    enabled:
      shouldFetchPrivateChat && (getChatByIdQueryOptions.enabled ?? true),
  });

  const getPublicChatQueryOptions = trpc.chat.getPublicChat.queryOptions({
    chatId,
  });
  const shouldFetchPublicChat = type === "shared";
  const { data: publicChat, isLoading: isPublicChatLoading } = useQuery({
    ...getPublicChatQueryOptions,
    enabled:
      shouldFetchPublicChat && (getPublicChatQueryOptions.enabled ?? true),
  });

  const resolvedProjectId =
    privateChat?.projectId ?? projectId ?? publicChat?.projectId ?? null;

  const fallbackProjectId = resolvedProjectId ?? DISABLED_PROJECT_ID;
  const projectQueryOptions = trpc.project.getById.queryOptions({
    id: fallbackProjectId,
  });
  const { data: project, isFetching: isProjectLoading } = useQuery({
    ...projectQueryOptions,
    enabled: isAuthenticated && !!resolvedProjectId,
  });

  const chatLabel = getChatLabel({
    privateChat,
    publicChat,
    isPrivateChatLoading,
    isPublicChatLoading,
    hasMessages,
  });

  const projectLabel = getProjectLabel(
    resolvedProjectId,
    project,
    isProjectLoading
  );

  const projectHref = resolvedProjectId
    ? `/project/${resolvedProjectId}`
    : undefined;

  return (
    <header className="sticky top-0 flex h-(--header-height) items-center justify-between gap-2 bg-background px-2 py-1.5 md:px-2">
      <div className="flex flex-1 items-center justify-between gap-2 overflow-hidden">
        <ChatBreadcrumbs
          chatLabel={chatLabel}
          className="ml-2"
          projectHref={projectHref}
          projectLabel={projectLabel}
        />

        {!isReadonly && hasMessages && <ShareButton chatId={chatId} />}
        {isReadonly && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-muted-foreground text-sm">
                <Share className="opacity-70" size={14} />
                <span>Shared</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <div className="font-medium">Shared Chat</div>
                <div className="mt-1 text-muted-foreground text-xs">
                  This is a shared chat
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <HeaderActions user={user} />
    </header>
  );
}

function ChatBreadcrumbs({
  chatLabel,
  projectHref,
  projectLabel,
  className,
}: {
  chatLabel: string;
  projectHref?: string;
  projectLabel?: string;
  className?: string;
}) {
  if (!chatLabel) {
    return null;
  }

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {projectHref && projectLabel ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink href={projectHref}>{projectLabel}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        ) : null}
        <BreadcrumbItem>
          <BreadcrumbPage>{chatLabel}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export const ChatHeader = memo(PureChatHeader);
