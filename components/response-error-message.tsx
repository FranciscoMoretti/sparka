import { RefreshCcwIcon } from "lucide-react";
import { useChatStoreApi } from "@/lib/stores/chat-store-context";
import { useSetMessages } from "@/lib/stores/hooks-base";
import { Button } from "./ui/button";

export function ResponseErrorMessage() {
  const setMessages = useSetMessages();
  const chatStore = useChatStoreApi();

  return (
    <div className="mx-auto flex w-full flex-col items-center gap-4 rounded-lg px-6 py-8 shadow-xs md:max-w-2xl">
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <title>Error</title>
          <path
            clipRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            fillRule="evenodd"
          />
        </svg>
        <p className="font-medium">Something went wrong</p>
      </div>
      <p className="text-center text-sm">
        An error occurred while processing your request. Please try again.
      </p>
      <Button
        className=" "
        onClick={() => {
          // Remove last message from assistant if exists
          const messagesWithoutLastAssistant = chatStore
            .getState()
            .messages.slice(0, -1);
          setMessages(messagesWithoutLastAssistant);
          chatStore.getState().currentChatHelpers?.regenerate?.();
        }}
        variant="outline"
      >
        <RefreshCcwIcon className="mr-2 h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
