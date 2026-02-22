import { type ModelMessage, Output, streamText } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import type { StreamWriter } from "@/lib/ai/types";
import { config } from "@/lib/config";
import { generateUUID } from "@/lib/utils";

export async function generateFollowupSuggestions(
  modelMessages: ModelMessage[]
) {
  const maxQuestionCount = 5;
  const minQuestionCount = 3;
  const maxCharactersPerQuestion = 80;
  return streamText({
    model: await getLanguageModel(config.ai.tools.followupSuggestions.default),
    messages: [
      ...modelMessages,
      {
        role: "user",
        content: `What question should I ask next? Return an array of suggested questions (minimum ${minQuestionCount}, maximum ${maxQuestionCount}). Each question should be no more than ${maxCharactersPerQuestion} characters.`,
      },
    ],
    output: Output.object({
      schema: z.object({
        suggestions: z
          .array(z.string())
          .min(minQuestionCount)
          .max(maxQuestionCount),
      }),
    }),
  });
}

export async function streamFollowupSuggestions({
  followupSuggestionsResult,
  writer,
}: {
  followupSuggestionsResult: ReturnType<typeof generateFollowupSuggestions>;
  writer: StreamWriter;
}) {
  const dataPartId = generateUUID();
  const result = await followupSuggestionsResult;

  for await (const chunk of result.partialOutputStream) {
    writer.write({
      id: dataPartId,
      type: "data-followupSuggestions",
      data: {
        suggestions:
          chunk.suggestions?.filter(
            (suggestion): suggestion is string => suggestion !== undefined
          ) ?? [],
      },
    });
  }
}
