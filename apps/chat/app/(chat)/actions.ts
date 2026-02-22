"use server";

import { generateText } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import type { ChatMessage } from "@/lib/ai/types";
import { config } from "@/lib/config";

export async function generateTitleFromUserMessage({
  message,
}: {
  message: ChatMessage;
}) {
  const { text: title } = await generateText({
    model: await getLanguageModel(config.ai.workflows.title),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 40 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
    experimental_telemetry: { isEnabled: true },
  });

  return title;
}
