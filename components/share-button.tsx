"use client";

import { Copy, GlobeIcon, Loader2, LockIcon, Share } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGetChatById, useSetVisibility } from "@/hooks/chat-sync-hooks";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/session-provider";
import { LoginPrompt } from "./upgrade-cta/login-prompt";

type ShareStep = "info" | "shared";

// Dialog content component that only renders when dialog is open
function ShareDialogContent({
  chatId,
  onClose,
}: {
  chatId: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<ShareStep>("info");
  const { data: chat } = useGetChatById(chatId);
  const setVisibilityMutation = useSetVisibility();

  const isPublic = chat?.visibility === "public";
  const isPending = setVisibilityMutation.isPending;

  const handleShare = () => {
    setVisibilityMutation.mutate(
      {
        chatId,
        visibility: "public",
      },
      {
        onSuccess: () => {
          setStep("shared");
        },
      }
    );
  };

  const handleUnshare = () => {
    setVisibilityMutation.mutate(
      {
        chatId,
        visibility: "private",
      },
      {
        onSuccess: () => {
          onClose();
          setStep("info");
        },
      }
    );
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/share/${chatId}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard");
  };

  return (
    <>
      {step === "info" && (
        <>
          <DialogHeader>
            <DialogTitle>Share chat</DialogTitle>
            <DialogDescription>
              {isPublic
                ? "This chat is currently public. Anyone with the link can view it."
                : "Make this chat public so you can share it with others."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
              {isPublic ? (
                <>
                  <div className="text-green-600">
                    <GlobeIcon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">Public</div>
                    <div className="text-muted-foreground text-xs">
                      Anyone with the link can access this chat
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-muted-foreground">
                    <LockIcon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">Private</div>
                    <div className="text-muted-foreground text-xs">
                      Only you can access this chat
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {isPublic ? (
                <>
                  <Button
                    className="flex-1"
                    disabled={isPending}
                    onClick={handleUnshare}
                    variant="outline"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        <span className="ml-2">Making Private...</span>
                      </>
                    ) : (
                      <>
                        <LockIcon size={16} />
                        <span className="ml-2">Make Private</span>
                      </>
                    )}
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={isPending}
                    onClick={() => setStep("shared")}
                  >
                    <GlobeIcon size={16} />
                    <span className="ml-2">Get Link</span>
                  </Button>
                </>
              ) : (
                <Button
                  className="w-full"
                  disabled={isPending}
                  onClick={handleShare}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span className="ml-2">Sharing...</span>
                    </>
                  ) : (
                    <>
                      <GlobeIcon size={16} />
                      <span className="ml-2">Share Chat</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {step === "shared" && (
        <>
          <DialogHeader>
            <DialogTitle>Share chat</DialogTitle>
            <DialogDescription>
              Copy the link below to share this chat with others.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <label className="sr-only" htmlFor="link">
                Link
              </label>
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                defaultValue={`${window.location.origin}/share/${chatId}`}
                id="link"
                readOnly
              />
            </div>
            <Button
              className="px-3"
              onClick={handleCopyLink}
              size="sm"
              type="submit"
            >
              <Copy size={16} />
              <span className="sr-only">Copy</span>
            </Button>
          </div>
          <div className="flex items-center justify-between pt-2">
            <Button onClick={() => setStep("info")} size="sm" variant="ghost">
              ← Back
            </Button>
            <Button
              disabled={isPending}
              onClick={handleUnshare}
              size="sm"
              variant="outline"
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span className="ml-2">Making Private...</span>
                </>
              ) : (
                <>
                  <LockIcon size={16} />
                  <span className="ml-2">Make Private</span>
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </>
  );
}

// Extracted dialog component that can be controlled externally
export function ShareDialog({
  chatId,
  open,
  onOpenChange,
  children,
}: {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}) {
  const handleDialogOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
  };

  return (
    <Dialog onOpenChange={handleDialogOpenChange} open={open}>
      {children}
      <DialogContent className="sm:max-w-md">
        {open && (
          <ShareDialogContent
            chatId={chatId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ShareButton({
  chatId,
  className,
}: {
  chatId: string;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  const triggerButton = (
    <Button className={cn("", className)} size="sm" variant="outline">
      <Share size={16} />
      <span className="sr-only">Share chat</span>
    </Button>
  );

  if (!isAuthenticated) {
    return (
      <Popover>
        <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <LoginPrompt
            description="Control who can see your conversations and share them with others."
            title="Sign in to share your chat"
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <ShareDialog chatId={chatId} onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
    </ShareDialog>
  );
}
