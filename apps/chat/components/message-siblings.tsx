import { ChevronLeft, ChevronRight } from "lucide-react";
import { memo } from "react";
import { Action } from "@/components/ai-elements/actions";
import { useNavigateToSibling } from "@/hooks/use-navigate-to-sibling";
import { useMessageRoleById } from "@/lib/stores/hooks-base";
import {
  useMessageSiblingInfo,
  useParallelGroupInfo,
} from "@/lib/stores/hooks-threads";
import { useSession } from "@/providers/session-provider";

function PureMessageSiblings({
  messageId,
  isReadOnly: _isReadOnly,
}: {
  messageId: string;
  isReadOnly: boolean;
}) {
  const { data: session } = useSession();
  const _isAuthenticated = !!session?.user;

  const role = useMessageRoleById(messageId);
  const siblingInfo = useMessageSiblingInfo(messageId);
  const parallelGroupInfo = useParallelGroupInfo(messageId);
  const navigateToSibling = useNavigateToSibling();
  const hasSiblings = siblingInfo && siblingInfo.siblings.length > 1;

  // Hide sibling nav for assistant messages in a parallel group — those use
  // the response cards for navigation. User messages should always show
  // sibling nav even when they spawned parallel responses.
  if (parallelGroupInfo && role === "assistant") {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-1">
      {hasSiblings && (
        <>
          <Action
            className="h-7 w-7 px-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            disabled={siblingInfo.siblingIndex === 0}
            onClick={() => navigateToSibling(messageId, "prev")}
            tooltip="Previous version"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Action>

          <span className="text-muted-foreground text-xs">
            {siblingInfo.siblingIndex + 1}/{siblingInfo.siblings.length}
          </span>

          <Action
            className="h-7 w-7 px-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            disabled={
              siblingInfo.siblingIndex === siblingInfo.siblings.length - 1
            }
            onClick={() => navigateToSibling(messageId, "next")}
            tooltip="Next version"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Action>
        </>
      )}
    </div>
  );
}

export const MessageSiblings = memo(PureMessageSiblings);
