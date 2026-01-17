import { streamText } from "ai";
import type { AppModelId, ModelId } from "@/lib/ai/app-models";
import { getLanguageModel } from "@/lib/ai/providers";
import { truncateMessages } from "@/lib/ai/token-utils";
import type { ToolSession } from "@/lib/ai/tools/types";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { generateUUID } from "@/lib/utils";
import type { StreamWriter } from "../../types";
import { createDocument } from "../create-document";
import type { DeepResearchConfig } from "./configuration";
import { finalReportGenerationPrompt } from "./prompts";
import type { AgentState } from "./state";
import { getModelContextWindow, getTodayStr } from "./utils";

type FinalReportGenerationInput = {
  state: AgentState;
  config: DeepResearchConfig;
  dataStream: StreamWriter;
  session: ToolSession;
  messageId: string;
  reportTitle: string;
  toolCallId: string;
  costAccumulator: CostAccumulator;
};

export async function finalReportGeneration(
  input: FinalReportGenerationInput
): Promise<Pick<AgentState, "final_report" | "reportResult">> {
  const {
    state,
    config,
    dataStream,
    session,
    messageId,
    reportTitle,
    toolCallId,
    costAccumulator,
  } = input;
  const notes = state.notes || [];

  const model = await getLanguageModel(config.final_report_model as ModelId);
  const findings = notes.join("\n");

  const finalReportPromptText = finalReportGenerationPrompt({
    research_brief: state.research_brief || "",
    findings,
    date: getTodayStr(),
  });

  const finalReportUpdateId = generateUUID();
  dataStream.write({
    id: finalReportUpdateId,
    type: "data-researchUpdate",
    data: {
      toolCallId,
      title: "Writing final report",
      type: "writing",
      status: "running",
    },
  });

  // Get model token limit and reserve space for output tokens
  const finalReportModelContextWindow = await getModelContextWindow(
    config.final_report_model as ModelId
  );

  // Truncate messages to fit within token limit
  const finalReportMessages = [
    { role: "user" as const, content: finalReportPromptText },
  ];
  const truncatedFinalMessages = truncateMessages(
    finalReportMessages,
    finalReportModelContextWindow
  );

  const { result: reportResult, content: reportContent } = await createDocument(
    {
      dataStream,
      session,
      messageId,
      selectedModel: config.final_report_model as ModelId,
      costAccumulator,
    },
    {
      kind: "text",
      title: reportTitle,
      description: "",
      prompt: finalReportPromptText,
      generate: async ({
        dataStream: stream,
        costAccumulator: accumulator,
      }) => {
        let draftContent = "";
        const streamResult = streamText({
          model,
          messages: truncatedFinalMessages,
          maxOutputTokens: config.final_report_model_max_tokens,
          experimental_telemetry: {
            isEnabled: true,
            functionId: "finalReportGeneration",
            metadata: {
              messageId,
              langfuseTraceId: state.requestId,
              langfuseUpdateParent: false,
            },
          },
          maxRetries: 3,
        });

        for await (const delta of streamResult.fullStream) {
          if (delta.type === "text-delta") {
            draftContent += delta.text;
            stream.write({
              type: "data-textDelta",
              data: delta.text,
              transient: true,
            });
          }
        }

        const usage = await streamResult.usage;
        if (usage) {
          accumulator?.addLLMCost(
            config.final_report_model as AppModelId,
            usage,
            "deep-research-final-report"
          );
        }

        return draftContent;
      },
    }
  );

  dataStream.write({
    id: finalReportUpdateId,
    type: "data-researchUpdate",
    data: {
      toolCallId,
      title: "Writing final report",
      type: "writing",
      status: "completed",
    },
  });

  return {
    final_report: reportContent,
    reportResult,
  };
}
