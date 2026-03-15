import { useMessageById } from "@ai-sdk-tools/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { getPrimarySelectedModelId, type ChatMessage } from "@/lib/ai/types";
import type { Vote } from "@/lib/db/schema";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";
import { MessageAction as Action } from "./ai-elements/message";
import { RetryButton } from "./retry-button";
import { Tag } from "./tag";

export function FeedbackActions({
  chatId,
  messageId,
  vote,
  isReadOnly,
}: {
  chatId: string;
  messageId: string;
  vote: Vote | undefined;
  isReadOnly: boolean;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const isAuthenticated = !!session?.user;

  const voteMessageMutation = useMutation(
    trpc.vote.voteMessage.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.vote.getVotes.queryKey({ chatId }),
        });
      },
    })
  );

  if (isReadOnly || !isAuthenticated) {
    return null;
  }

  return (
    <>
      <Action
        className="pointer-events-auto! h-7 w-7 p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        data-testid="message-downvote"
        disabled={vote && !vote.isUpvoted}
        onClick={() => {
          toast.promise(
            voteMessageMutation.mutateAsync({
              chatId,
              messageId,
              type: "down" as const,
            }),
            {
              loading: "Downvoting Response...",
              success: "Downvoted Response!",
              error: "Failed to downvote response.",
            }
          );
        }}
        tooltip="Downvote Response"
      >
        <ThumbsDown size={14} />
      </Action>

      <Action
        className="pointer-events-auto! h-7 w-7 p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        data-testid="message-upvote"
        disabled={vote?.isUpvoted}
        onClick={() => {
          toast.promise(
            voteMessageMutation.mutateAsync({
              chatId,
              messageId,
              type: "up" as const,
            }),
            {
              loading: "Upvoting Response...",
              success: "Upvoted Response!",
              error: "Failed to upvote response.",
            }
          );
        }}
        tooltip="Upvote Response"
      >
        <ThumbsUp size={14} />
      </Action>

      <RetryButton messageId={messageId} />
      <SelectedModelId messageId={messageId} />
    </>
  );
}

function SelectedModelId({ messageId }: { messageId: string }) {
  const message = useMessageById<ChatMessage>(messageId);
  const selectedModelId = getPrimarySelectedModelId(
    message?.metadata?.selectedModel
  );

  return selectedModelId ? (
    <div className="ml-2 flex items-center">
      <Tag>{selectedModelId}</Tag>
    </div>
  ) : null;
}
