"use client";

import { useChat } from "@ai-sdk-tools/store";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { toast } from "sonner";
import { useDataStream } from "@/components/data-stream-provider";
import { useSaveMessageMutation } from "@/hooks/chat-sync-hooks";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { ChatSDKError } from "@/lib/ai/errors";
import type { ChatMessage } from "@/lib/ai/types";
import { fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { useSession } from "@/providers/session-provider";

// function useRecreateChat(id: string, initialMessages: ChatMessage[]) {
//   const chatStore = useChatStoreApi();
//   useEffect(() => {
//     if (id !== chatStore.getState().id) {
//       chatStore.getState().setNewChat(id, initialMessages || []);
//     }
//   }, [id, initialMessages, chatStore]);
// }

export function ChatSync({
  id,
  initialMessages,
  projectId,
}: {
  id: string;
  initialMessages: ChatMessage[];
  projectId?: string;
}) {
  // const chatStore = useChatStoreApi();
  const { data: session } = useSession();
  const { mutate: saveChatMessage } = useSaveMessageMutation();
  const { setDataStream } = useDataStream();
  const [autoResume, setAutoResume] = useState(true);

  // useRecreateChat(id, initialMessages);

  const isAuthenticated = !!session?.user;
  // const chatState = useChatStateInstance();

  // console.log('chatState', chatState);
  // const chat = useMemo(() => {
  //   const instance = new ZustandChat<ChatMessage>({
  //     state: chatState,
  //     id,
  //     generateId: generateUUID,
  //     onFinish: ({ message }) => {
  //       saveChatMessage({ message, chatId: id });
  //     },
  //     transport: new DefaultChatTransport({
  //       api: "/api/chat",
  //       fetch: fetchWithErrorHandlers,
  //       prepareSendMessagesRequest({ messages, id, body }) {
  //         console.log('prepareSendMessagesRequest', messages, id, body);
  //         return {
  //           body: {
  //             id,
  //             message: messages.at(-1),
  //             prevMessages: isAuthenticated ? [] : messages.slice(0, -1),
  //             ...body,
  //           },
  //         };
  //       },
  //     }),
  //     onData: (dataPart) => {
  //       setDataStream((ds) => (ds ? [...ds, dataPart] : []));
  //     },
  //     onError: (error) => {
  //       console.error(error);
  //       const cause = error.cause;
  //       if (cause && typeof cause === "string") {
  //         toast.error(error.message ?? "An error occured, please try again!", {
  //           description: cause,
  //         });
  //       } else {
  //         toast.error(error.message ?? "An error occured, please try again!");
  //       }
  //     },
  //   });
  //   return instance;
  // }, [id, saveChatMessage, setDataStream, isAuthenticated, chatState]);

  const helpers = useChat<ChatMessage>({
    // store: chatStore,
    experimental_throttle: 100,
    id,
    generateId: generateUUID,
    onFinish: ({ message }) => {
      saveChatMessage({ message, chatId: id });
      setAutoResume(true);
    },
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest({ messages, id: requestId, body }) {
        setAutoResume(true);

        return {
          body: {
            id: requestId,
            message: messages.at(-1),
            prevMessages: isAuthenticated ? [] : messages.slice(0, -1),
            projectId,
            ...body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onError: (error) => {
      if (
        error instanceof ChatSDKError &&
        error.type === "not_found" &&
        error.surface === "stream"
      ) {
        setAutoResume(false);
      }

      console.error(error);
      const cause = error.cause;
      if (cause && typeof cause === "string") {
        toast.error(error.message ?? "An error occured, please try again!", {
          description: cause,
        });
      } else {
        toast.error(error.message ?? "An error occured, please try again!");
      }
    },
  });

  // useEffect(() => {
  //   console.log('setting current chat helpers');

  //   chatStore.getState()._syncState({
  //     // ...chatStore.getState(),
  //     stop: helpers.stop,
  //     sendMessage: helpers.sendMessage,
  //     regenerate: helpers.regenerate,
  //   });

  // }, [helpers.stop, helpers.sendMessage, helpers.regenerate, chatStore]);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream: helpers.resumeStream,
  });

  return null;
}
