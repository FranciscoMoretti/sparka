import { useChatActions } from "@ai-sdk-tools/store";
import { useCallback } from "react";
import { useDataStream } from "@/components/data-stream-provider";
import { useArtifact } from "@/hooks/use-artifact";
import type { ChatMessage } from "@/lib/ai/types";
import { useSwitchToMessage } from "@/lib/stores/hooks-threads";

export function useNavigateToMessage() {
  const { stop } = useChatActions<ChatMessage>();
  const { setDataStream } = useDataStream();
  const { artifact, closeArtifact } = useArtifact();
  const switchToMessage = useSwitchToMessage();

  return useCallback(
    (messageId: string) => {
      stop?.();
      setDataStream([]);

      const newThread = switchToMessage(messageId);

      if (
        newThread &&
        artifact.isVisible &&
        artifact.messageId &&
        !newThread.some((message) => message.id === artifact.messageId)
      ) {
        closeArtifact();
      }
    },
    [
      artifact.isVisible,
      artifact.messageId,
      closeArtifact,
      setDataStream,
      stop,
      switchToMessage,
    ]
  );
}
