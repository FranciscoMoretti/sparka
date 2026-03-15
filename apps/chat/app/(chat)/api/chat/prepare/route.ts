import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import type { ChatMessage } from "@/lib/ai/types";
import { auth } from "@/lib/auth";
import {
  getChatById,
  getMessageById,
  getUserById,
  saveChatIfNotExists,
  saveMessageIfNotExists,
} from "@/lib/db/queries";
import { createModuleLogger } from "@/lib/logger";
import { generateTitleFromUserMessage } from "../../../actions";

const log = createModuleLogger("api:chat:prepare");

export async function POST(request: NextRequest) {
  try {
    const {
      id: chatId,
      message: userMessage,
      projectId,
    }: {
      id: string;
      message: ChatMessage;
      projectId?: string;
    } = await request.json();

    if (!userMessage) {
      return new Response("Missing user message", { status: 400 });
    }

    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    if (!userId) {
      return new Response("Multiple models require authentication", {
        status: 401,
      });
    }

    const user = await getUserById({ userId });
    if (!user) {
      return new Response("User not found", { status: 404 });
    }

    const chat = await getChatById({ id: chatId });
    let isNewChat = false;

    if (chat) {
      if (chat.userId !== userId) {
        return new Response("Unauthorized", { status: 401 });
      }
    } else {
      isNewChat = true;
      const title = await generateTitleFromUserMessage({
        message: userMessage,
      });

      await saveChatIfNotExists({
        id: chatId,
        userId,
        title,
        projectId,
      });
    }

    const [existingMessage] = await getMessageById({ id: userMessage.id });

    if (existingMessage && existingMessage.chatId !== chatId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await saveMessageIfNotExists({
      id: userMessage.id,
      chatId,
      message: userMessage,
    });

    return Response.json({ isNewChat });
  } catch (error) {
    log.error({ error }, "POST /api/chat/prepare failed");
    return new Response("Internal Server Error", { status: 500 });
  }
}
