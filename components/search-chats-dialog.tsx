"use client";

import { isToday, isYesterday, subMonths, subWeeks } from "date-fns";
import { MessageSquare } from "lucide-react";
import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGetAllChats } from "@/hooks/chat-sync-hooks";
import type { UIChat } from "@/lib/types/ui-chat";

type GroupedChats = {
  today: UIChat[];
  yesterday: UIChat[];
  lastWeek: UIChat[];
  lastMonth: UIChat[];
  older: UIChat[];
};

const groupChatsByDate = (chats: UIChat[]): GroupedChats => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return chats.reduce(
    (groups, chat) => {
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
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedChats
  );
};

const filterChats = (chats: UIChat[], query: string): UIChat[] => {
  if (!query.trim()) {
    return chats;
  }
  const lowerQuery = query.toLowerCase();
  return chats.filter((chat) => chat.title.toLowerCase().includes(lowerQuery));
};

type SearchChatsListProps = {
  onSelectChat: (chatId: string) => void;
  deferredQuery: string;
};

const SearchChatsList = memo(function SearchChatsListInner({
  onSelectChat,
  deferredQuery,
}: SearchChatsListProps) {
  const { data: chats, isLoading } = useGetAllChats();

  const groupedChats = useMemo(() => {
    if (!chats) {
      return null;
    }
    const filteredChats = filterChats(chats, deferredQuery);
    return groupChatsByDate(filteredChats);
  }, [chats, deferredQuery]);

  const renderChatGroup = (
    groupChats: UIChat[],
    groupName: string,
    key: string
  ) => {
    if (groupChats.length === 0) {
      return null;
    }

    return (
      <CommandGroup heading={groupName} key={key}>
        {groupChats.map((chat) => (
          <CommandItem
            className="flex cursor-pointer items-center gap-2 p-2"
            key={chat.id}
            onSelect={() => onSelectChat(chat.id)}
            value={chat.id}
          >
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{chat.title}</span>
            </div>
          </CommandItem>
        ))}
      </CommandGroup>
    );
  };

  const hasResults =
    groupedChats &&
    (groupedChats.today.length > 0 ||
      groupedChats.yesterday.length > 0 ||
      groupedChats.lastWeek.length > 0 ||
      groupedChats.lastMonth.length > 0 ||
      groupedChats.older.length > 0);

  return (
    <>
      {!hasResults && (
        <CommandEmpty>
          {isLoading ? "Loading chats..." : "No chats found."}
        </CommandEmpty>
      )}

      {groupedChats && (
        <>
          {renderChatGroup(groupedChats.today, "Today", "today")}
          {renderChatGroup(groupedChats.yesterday, "Yesterday", "yesterday")}
          {renderChatGroup(groupedChats.lastWeek, "Last 7 days", "lastWeek")}
          {renderChatGroup(groupedChats.lastMonth, "Last 30 days", "lastMonth")}
          {renderChatGroup(groupedChats.older, "Older", "older")}
        </>
      )}
    </>
  );
});

type SearchChatsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectChat: () => void;
};

export function SearchChatsDialog({
  open,
  onOpenChange,
  onSelectChat,
}: SearchChatsDialogProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const handleSelectChat = useCallback(
    (chatId: string) => {
      onOpenChange(false);
      onSelectChat();
      setQuery("");
      window.history.pushState(null, "", `/chat/${chatId}`);
    },
    [onOpenChange, onSelectChat]
  );

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      onOpenChange(newOpen);
      if (!newOpen) {
        setQuery("");
      }
    },
    [onOpenChange]
  );

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogHeader className="sr-only">
        <DialogTitle>Search Chats</DialogTitle>
        <DialogDescription>Search through your chat history</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <Command
          className="**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          shouldFilter={false}
        >
          <CommandInput
            onValueChange={setQuery}
            placeholder="Search your chats..."
            value={query}
          />
          <CommandList>
            {open && (
              <SearchChatsList
                deferredQuery={deferredQuery}
                onSelectChat={handleSelectChat}
              />
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
