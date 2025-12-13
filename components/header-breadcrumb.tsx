"use client";
import { ChevronDown } from "lucide-react";
import { type KeyboardEvent, memo, useEffect, useState } from "react";
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
  useGetChatById,
  usePinChat,
  useProject,
  useRenameChat,
} from "@/hooks/chat-sync-hooks";
import { useIsSharedRoute } from "@/hooks/use-is-shared-route";
import { usePublicChat } from "@/hooks/use-shared-chat";
import type { Session } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useChatId } from "@/providers/chat-id-provider";

type HeaderBreadcrumbProps = {
  chatId: string;
  projectId?: string;
  user?: Session["user"];
  isReadonly: boolean;
  className?: string;
};

export function HeaderBreadcrumb({
  chatId: _chatId,
  projectId: _projectId,
  user,
  isReadonly,
  className,
}: HeaderBreadcrumbProps) {
  const { id: chatId, isPersisted } = useChatId();
  const isShared = useIsSharedRoute();
  const isAuthenticated = !!user;

  const { data: chat } = useGetChatById(chatId, {
    enabled: !isShared && isPersisted,
  });
  const { data: publicChat } = usePublicChat(chatId, {
    enabled: isShared,
  });

  const resolvedProjectId = chat?.projectId ?? publicChat?.projectId ?? null;

  const { data: project, isFetching: isProjectLoading } = useProject(
    resolvedProjectId,
    { enabled: isAuthenticated && Boolean(resolvedProjectId) }
  );

  const chatLabel = chat?.title ?? publicChat?.title ?? "";
  const shouldHideBreadcrumb = !chatLabel;

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
    value: chat?.title,
  });

  if (!(chat || publicChat)) {
    return null;
  }

  const canManageChat = !isReadonly && !!chat;

  const handlePinToggle = () => {
    pinChatMutation({ chatId, isPinned: !chat?.isPinned });
  };

  const handleChatRename = () =>
    performChatRename({
      chatId,
      chatTitleDraft,
      privateChat: chat,
      renameChat: renameChatMutation,
      setChatTitleDraft,
      setIsChatEditing,
    });

  const handleChatInputKeyDown = createInputKeyDownHandler({
    onEnter: () => {
      handleChatRename().catch(() => {
        // No-op: already handled via rename hook
      });
    },
    onEscape: () => {
      setIsChatEditing(false);
      setChatTitleDraft(chat?.title ?? "");
    },
  });

  const openChatDeleteDialog = () => {
    setChatDeleteId(chatId);
    setShowChatDeleteDialog(true);
  };

  const startChatRename = () => {
    setIsChatEditing(true);
    setChatTitleDraft(chat?.title ?? "");
  };

  if (shouldHideBreadcrumb) {
    return null;
  }

  return (
    <>
      <Breadcrumb className={cn("flex-1", className)}>
        <BreadcrumbList>
          <ProjectBreadcrumb
            projectId={resolvedProjectId}
            projectLabel={projectLabel}
          />
          <BreadcrumbItem>
            {
              <PureChatBreadcrumb
                canManageChat={canManageChat}
                chatLabel={chatLabel}
                chatTitleDraft={chatTitleDraft}
                handleChatInputKeyDown={handleChatInputKeyDown}
                handleChatRename={handleChatRename}
                isChatEditing={isChatEditing}
                isPinned={!!chat?.isPinned}
                onChatTitleChange={(value: string) => setChatTitleDraft(value)}
                onTogglePin={handlePinToggle}
                openChatDeleteDialog={openChatDeleteDialog}
                startChatRename={startChatRename}
              />
            }
          </BreadcrumbItem>
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

type ChatBreadcrumbProps = {
  canManageChat: boolean;
  chatLabel: string;
  chatTitleDraft: string;
  handleChatInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  handleChatRename: () => Promise<void> | void;
  isChatEditing: boolean;
  isPinned: boolean;
  onChatTitleChange: (value: string) => void;
  onTogglePin: () => void;
  openChatDeleteDialog: () => void;
  startChatRename: () => void;
};

const PureChatBreadcrumb = memo(function InnerChatBreadcrumb({
  canManageChat,
  chatLabel,
  chatTitleDraft,
  handleChatInputKeyDown,
  handleChatRename,
  isChatEditing,
  isPinned,
  onChatTitleChange,
  onTogglePin,
  openChatDeleteDialog,
  startChatRename: startChatRenameProp,
}: ChatBreadcrumbProps) {
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
          <button
            className="group flex max-w-[220px] items-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-1 font-medium text-foreground text-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            type="button"
          >
            <span className="truncate">{chatLabel}</span>
            <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <ChatMenuItems
            includeShareItem={false}
            isPinned={isPinned}
            onDelete={openChatDeleteDialog}
            onRename={startChatRenameProp}
            onTogglePin={onTogglePin}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return <BreadcrumbPage>{chatLabel}</BreadcrumbPage>;
});

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

function ProjectBreadcrumb({
  projectLabel,
  projectId,
}: {
  projectLabel?: string;
  projectId: string | null;
}) {
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
