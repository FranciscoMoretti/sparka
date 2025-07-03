'use client';

import { isToday, isYesterday, subMonths, subWeeks } from 'date-fns';
import { Link, useNavigate } from 'react-router';
import type { User } from 'next-auth';
import { memo, useCallback, useState } from 'react';
import { toast } from 'sonner';

import {
  MoreHorizontalIcon,
  TrashIcon,
  PencilEditIcon,
} from '@/components/icons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import type { UIChat } from '@/lib/types/ui';
import {
  useDeleteChat,
  useRenameChat,
  useGetAllChats,
  useTogglePinned,
} from '@/hooks/use-chat-store';
import { useChatId } from '@/providers/chat-id-provider';
import { ShareDialog } from '@/components/share-button';
import { ShareMenuItem } from '@/components/upgrade-cta/share-menu-item';

type GroupedChats = {
  pinned: UIChat[];
  today: UIChat[];
  yesterday: UIChat[];
  lastWeek: UIChat[];
  lastMonth: UIChat[];
  older: UIChat[];
};

const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  onRename,
  onTogglePin,
  setOpenMobile,
}: {
  chat: UIChat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  onRename: (chatId: string, title: string) => void;
  onTogglePin: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(chat.title);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const handleRename = async () => {
    if (editTitle.trim() === '' || editTitle === chat.title) {
      setIsEditing(false);
      setEditTitle(chat.title);
      return;
    }

    try {
      await onRename(chat.id, editTitle.trim());
      setIsEditing(false);
      toast.success('Chat renamed successfully');
    } catch (error) {
      setEditTitle(chat.title);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditTitle(chat.title);
    }
  };

  return (
    <SidebarMenuItem>
      {isEditing ? (
        <div className="flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm bg-background">
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            className="h-auto border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
            maxLength={255}
          />
        </div>
      ) : (
        <SidebarMenuButton asChild isActive={isActive}>
          <Link to={`/chat/${chat.id}`} onClick={() => setOpenMobile(false)}>
            <span>{chat.title}</span>
          </Link>
        </SidebarMenuButton>
      )}

      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground mr-0.5"
            showOnHover={!isActive}
          >
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="bottom" align="end">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              setIsEditing(true);
              setEditTitle(chat.title);
            }}
          >
            <PencilEditIcon />
            <span>Rename</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => onTogglePin(chat.id)}
          >
            <PinIcon />
            <span>{chat.pinned ? 'Unpin' : 'Pin'}</span>
          </DropdownMenuItem>

          <ShareMenuItem onShare={() => setShareDialogOpen(true)} />

          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
            onSelect={() => onDelete(chat.id)}
          >
            <TrashIcon />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {shareDialogOpen && (
        <ShareDialog
          chatId={chat.id}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
        />
      )}
    </SidebarMenuItem>
  );
};

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) return false;
  if (prevProps.chat.id !== nextProps.chat.id) return false;
  if (prevProps.chat.title !== nextProps.chat.title) return false;
  return true;
});

// Simple pin icon component
const PinIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    height={size}
    viewBox="0 0 16 16"
    width={size}
    style={{ color: 'currentcolor' }}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9.5 2C9.5 1.17157 8.82843 0.5 8 0.5C7.17157 0.5 6.5 1.17157 6.5 2V3H5V4.5H6.5V8.5L4.5 10.5H3V12H7V15.5H8V12H12V10.5H10.5L8.5 8.5V4.5H10V3H8.5V2H9.5Z"
      fill="currentColor"
    />
  </svg>
);

export function SidebarHistory({ user }: { user: User | undefined }) {
  const { setOpenMobile } = useSidebar();
  const { chatId, refreshChatID } = useChatId();
  const navigate = useNavigate();

  const { mutate: renameChatMutation } = useRenameChat();
  const { deleteChat } = useDeleteChat();
  const { mutate: togglePinnedMutation } = useTogglePinned();

  const { data: chats, isLoading } = useGetAllChats(100);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const renameChat = useCallback(
    (chatId: string, title: string) => {
      renameChatMutation({ chatId, title });
    },
    [renameChatMutation],
  );

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await deleteChat(deleteId, {
        onSuccess: () => toast.success('Chat deleted successfully'),
        onError: () => toast.error('Failed to delete chat'),
      });
    } catch (error) {
      // Error already handled by onError callback
    }

    setShowDeleteDialog(false);

    if (deleteId === chatId) {
      refreshChatID();
      navigate('/');
    }
  };

  if (!user && !isLoading && chats?.length === 0) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2">
            Start chatting to see your conversation history!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (isLoading) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
          Today
        </div>
        <SidebarGroupContent>
          <div className="flex flex-col">
            {[44, 32, 28, 64, 52].map((item) => (
              <div
                key={item}
                className="rounded-md h-8 flex gap-2 px-2 items-center"
              >
                <div
                  className="h-4 rounded-md flex-1 max-w-[--skeleton-width] bg-sidebar-accent-foreground/10"
                  style={
                    {
                      '--skeleton-width': `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (chats?.length === 0) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2">
            Your conversations will appear here once you start chatting!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  const groupChatsByDate = (chats: UIChat[]): GroupedChats => {
    const now = new Date();
    const oneWeekAgo = subWeeks(now, 1);
    const oneMonthAgo = subMonths(now, 1);

    return chats.reduce(
      (groups, chat) => {
        if (chat.pinned) {
          groups.pinned.push(chat);
          return groups;
        }

        const chatDate = new Date(chat.createdAt);

        if (isToday(chatDate)) {
          groups.today.push(chat);
        } else if (isYesterday(chatDate)) {
          groups.yesterday.push(chat);
        } else if (chatDate > oneWeekAgo) {
          groups.lastWeek.push(chat);
        } else if (chatDate > oneMonthAgo) {
          groups.lastMonth.push(chat);
        } else {
          groups.older.push(chat);
        }

        return groups;
      },
      {
        pinned: [],
        today: [],
        yesterday: [],
        lastWeek: [],
        lastMonth: [],
        older: [],
      } as GroupedChats,
    );
  };

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {chats &&
              (() => {
                const groupedChats = groupChatsByDate(chats);

                return (
                  <>
                    {groupedChats.pinned.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                          Pinned
                        </div>
                        {groupedChats.pinned.map((chat) => (
                          <ChatItem
                            key={chat.id}
                            chat={chat}
                            isActive={chat.id === chatId}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onRename={renameChat}
                            onTogglePin={(chatId) => {
                              togglePinnedMutation({ chatId });
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </>
                    )}

                    {groupedChats.today.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                          Today
                        </div>
                        {groupedChats.today.map((chat) => (
                          <ChatItem
                            key={chat.id}
                            chat={chat}
                            isActive={chat.id === chatId}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onRename={renameChat}
                            onTogglePin={(chatId) => {
                              togglePinnedMutation({ chatId });
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </>
                    )}

                    {groupedChats.yesterday.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50 mt-6">
                          Yesterday
                        </div>
                        {groupedChats.yesterday.map((chat) => (
                          <ChatItem
                            key={chat.id}
                            chat={chat}
                            isActive={chat.id === chatId}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onRename={renameChat}
                            onTogglePin={(chatId) => {
                              togglePinnedMutation({ chatId });
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </>
                    )}

                    {groupedChats.lastWeek.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50 mt-6">
                          Last 7 days
                        </div>
                        {groupedChats.lastWeek.map((chat) => (
                          <ChatItem
                            key={chat.id}
                            chat={chat}
                            isActive={chat.id === chatId}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onRename={renameChat}
                            onTogglePin={(chatId) => {
                              togglePinnedMutation({ chatId });
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </>
                    )}

                    {groupedChats.lastMonth.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50 mt-6">
                          Last 30 days
                        </div>
                        {groupedChats.lastMonth.map((chat) => (
                          <ChatItem
                            key={chat.id}
                            chat={chat}
                            isActive={chat.id === chatId}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onRename={renameChat}
                            onTogglePin={(chatId) => {
                              togglePinnedMutation({ chatId });
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </>
                    )}

                    {groupedChats.older.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs text-sidebar-foreground/50 mt-6">
                          Older
                        </div>
                        {groupedChats.older.map((chat) => (
                          <ChatItem
                            key={chat.id}
                            chat={chat}
                            isActive={chat.id === chatId}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onRename={renameChat}
                            onTogglePin={(chatId) => {
                              togglePinnedMutation({ chatId });
                            }}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </>
                    )}
                  </>
                );
              })()}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              chat and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
