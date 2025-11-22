"use client";
import { Share } from "lucide-react";
import { memo } from "react";
import { HeaderActions } from "@/components/header-actions";
import { HeaderBreadcrumb } from "@/components/header-breadcrumb";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import type { Session } from "@/lib/auth";
import { ShareButton } from "./share-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

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
  user?: Session["user"];
}) {
  const { isMobile } = useSidebar();

  return (
    <header className="sticky top-0 flex h-(--header-height) items-center justify-between gap-2 bg-background px-2 py-1.5 md:px-2">
      <div className="flex flex-1 items-center justify-between gap-2 overflow-hidden">
        <div className="flex items-center gap-2">
          {isMobile && <SidebarTrigger />}
          <HeaderBreadcrumb
            chatId={chatId}
            className="ml-2"
            hasMessages={hasMessages}
            isReadonly={isReadonly}
            projectId={projectId}
            user={user}
          />
        </div>

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

      <HeaderActions />
    </header>
  );
}
export const ChatHeader = memo(PureChatHeader);
