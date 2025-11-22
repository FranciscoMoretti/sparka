"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChatMenuItems } from "@/components/chat-menu-items";
import { DeleteChatDialog } from "@/components/delete-chat-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  useGetChatByIdQueryOptions,
  usePinChat,
  useRenameChat,
} from "@/hooks/chat-sync-hooks";
import type { Session } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useChatId } from "@/providers/chat-id-provider";
import { useTRPC } from "@/trpc/react";

const DISABLED_PROJECT_ID = "00000000-0000-0000-0000-000000000000";

function getChatLabel({
  privateTitle,
  publicTitle,
  isPrivateChatLoading,
  isPublicChatLoading,
  hasMessages,
}: {
  privateTitle?: string;
  publicTitle?: string;
  isPrivateChatLoading: boolean;
  isPublicChatLoading: boolean;
  hasMessages: boolean;
}): string {
  if (privateTitle) {
    return privateTitle;
  }
  if (publicTitle) {
    return publicTitle;
  }
  if (isPrivateChatLoading || isPublicChatLoading) {
    return "Loading chat…";
  }
  if (hasMessages) {
    return "Untitled chat";
  }
  return "New chat";
}

type HeaderBreadcrumbProps = {
  chatId: string;
  projectId?: string;
  hasMessages: boolean;
  user?: Session["user"];
  isReadonly: boolean;
  className?: string;
};

export function HeaderBreadcrumb({
  chatId,
  projectId,
  hasMessages,
  user,
  isReadonly,
  className,
}: HeaderBreadcrumbProps) {
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
    privateTitle: privateChat?.title,
    publicTitle: publicChat?.title,
    isPrivateChatLoading,
    isPublicChatLoading,
    hasMessages,
  });
  const shouldHideBreadcrumb = chatLabel === "New chat";

  const projectLabel = resolvedProjectId
    ? (project?.name ?? (isProjectLoading ? "Loading project…" : undefined))
    : undefined;

  const [isChatEditing, setIsChatEditing] = useState(false);
  const [chatTitleDraft, setChatTitleDraft] = useState("");
  const [chatDeleteId, setChatDeleteId] = useState<string | null>(null);
  const [showChatDeleteDialog, setShowChatDeleteDialog] = useState(false);

  const { mutate: pinChatMutation } = usePinChat();
  const { mutateAsync: renameChatMutation } = useRenameChat();

  useSyncDraftValue({
    isEditing: isChatEditing,
    setDraft: setChatTitleDraft,
    value: privateChat?.title,
  });

  const canManageChat = !isReadonly && !!privateChat;

  const handlePinToggle = () => {
    pinChatMutation({ chatId, isPinned: !privateChat?.isPinned });
  };

  const handleChatRename = () =>
    performChatRename({
      chatId,
      chatTitleDraft,
      privateChat,
      renameChat: renameChatMutation,
      setChatTitleDraft,
      setIsChatEditing,
    });

  const crumbButtonClass =
    "group flex max-w-[220px] items-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  const handleChatInputKeyDown = createInputKeyDownHandler({
    onEnter: () => {
      handleChatRename().catch(() => {
        // No-op: already handled via rename hook
      });
    },
    onEscape: () => {
      setIsChatEditing(false);
      setChatTitleDraft(privateChat?.title ?? "");
    },
  });

  const openChatDeleteDialog = () => {
    setChatDeleteId(chatId);
    setShowChatDeleteDialog(true);
  };

  const startChatRename = () => {
    setIsChatEditing(true);
    setChatTitleDraft(privateChat?.title ?? "");
  };

  const chatBreadcrumbContent = getChatBreadcrumbContent({
    canManageChat,
    crumbButtonClass,
    handleChatInputKeyDown,
    handleChatRename,
    isChatEditing,
    onChatTitleChange: (value: string) => setChatTitleDraft(value),
    openChatDeleteDialog,
    chatLabel,
    chatTitleDraft,
    startChatRename,
    isPinned: !!privateChat?.isPinned,
    onTogglePin: handlePinToggle,
  });

  if (shouldHideBreadcrumb) {
    return null;
  }

  const projectBreadcrumb = renderProjectBreadcrumb({
    projectLabel,
    projectId: resolvedProjectId,
  });

  return (
    <>
      <Breadcrumb className={cn("flex-1", className)}>
        <BreadcrumbList>
          {projectBreadcrumb}
          <BreadcrumbItem>{chatBreadcrumbContent}</BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <DeleteChatDialog
        deleteId={chatDeleteId}
        setShowDeleteDialog={setShowChatDeleteDialog}
        showDeleteDialog={showChatDeleteDialog}
      />
    </>
  );
}

type ChatBreadcrumbArgs = {
  canManageChat: boolean;
  chatLabel: string;
  chatTitleDraft: string;
  crumbButtonClass: string;
  handleChatInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  handleChatRename: () => Promise<void> | void;
  isChatEditing: boolean;
  isPinned: boolean;
  onChatTitleChange: (value: string) => void;
  onTogglePin: () => void;
  openChatDeleteDialog: () => void;
  startChatRename: () => void;
};

function getChatBreadcrumbContent({
  canManageChat,
  chatLabel,
  chatTitleDraft,
  crumbButtonClass,
  handleChatInputKeyDown,
  handleChatRename,
  isChatEditing,
  isPinned,
  onChatTitleChange,
  onTogglePin,
  openChatDeleteDialog,
  startChatRename,
}: ChatBreadcrumbArgs): ReactNode {
  if (isChatEditing) {
    return (
      <Input
        autoFocus
        className="h-7 w-[220px] bg-background px-2 py-1 text-sm"
        maxLength={255}
        onBlur={handleChatRename}
        onChange={(event) => onChatTitleChange(event.target.value)}
        onKeyDown={handleChatInputKeyDown}
        value={chatTitleDraft}
      />
    );
  }

  if (canManageChat) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={crumbButtonClass} type="button">
            <span className="truncate">{chatLabel}</span>
            <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <ChatMenuItems
            includeShareItem={false}
            isPinned={isPinned}
            onDelete={openChatDeleteDialog}
            onRename={startChatRename}
            onTogglePin={onTogglePin}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return <BreadcrumbPage>{chatLabel}</BreadcrumbPage>;
}

type PerformChatRenameArgs = {
  chatId: string;
  chatTitleDraft: string;
  privateChat: { title?: string; isPinned?: boolean } | null | undefined;
  renameChat: (args: { chatId: string; title: string }) => Promise<unknown>;
  setChatTitleDraft: (value: string) => void;
  setIsChatEditing: (value: boolean) => void;
};

async function performChatRename({
  chatId,
  chatTitleDraft,
  privateChat,
  renameChat,
  setChatTitleDraft,
  setIsChatEditing,
}: PerformChatRenameArgs) {
  if (!privateChat) {
    setIsChatEditing(false);
    return;
  }
  const trimmed = chatTitleDraft.trim();
  if (!trimmed || trimmed === privateChat.title) {
    setIsChatEditing(false);
    setChatTitleDraft(privateChat.title ?? "");
    return;
  }
  try {
    await renameChat({ chatId, title: trimmed });
    toast.success("Chat renamed successfully");
  } catch {
    // Errors handled in hook
  } finally {
    setIsChatEditing(false);
  }
}

type InputKeyHandlerOptions = {
  onEnter: () => void;
  onEscape: () => void;
};

function createInputKeyDownHandler({
  onEnter,
  onEscape,
}: InputKeyHandlerOptions) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      onEnter();
      return;
    }
    if (event.key === "Escape") {
      onEscape();
    }
  };
}

function useSyncDraftValue({
  isEditing,
  setDraft,
  value,
}: {
  isEditing: boolean;
  setDraft: (val: string) => void;
  value: string | undefined;
}) {
  useEffect(() => {
    if (!isEditing) {
      setDraft(value ?? "");
    }
  }, [isEditing, setDraft, value]);
}

function renderProjectBreadcrumb({
  projectLabel,
  projectId,
}: {
  projectLabel?: string;
  projectId: string | null;
}): ReactNode {
  if (!(projectLabel && projectId)) {
    return null;
  }

  return (
    <>
      <BreadcrumbItem>
        <BreadcrumbLink href={`/project/${projectId}`}>
          {projectLabel}
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
    </>
  );
}
