import type {
  InferUITool,
  LanguageModelUsage,
  UIMessage,
  UIMessageStreamWriter,
} from "ai";
import { z } from "zod";
import type { codeInterpreter } from "@/lib/ai/tools/code-interpreter";
import type { deepResearch } from "@/lib/ai/tools/deep-research/deep-research";
import type { generateImage } from "@/lib/ai/tools/generate-image";
import type { getWeather } from "@/lib/ai/tools/get-weather";
import type { readDocument } from "@/lib/ai/tools/read-document";
import type { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import type { retrieve } from "@/lib/ai/tools/retrieve";
import type { updateDocument } from "@/lib/ai/tools/update-document";
import type { tavilyWebSearch } from "@/lib/ai/tools/web-search";
import type { Suggestion } from "@/lib/db/schema";
import type { ArtifactKind } from "../artifacts/artifact-kind";
import type { AppModelId } from "./app-models";
import type { createDocumentTool as createDocument } from "./tools/create-document";
import type { ResearchUpdate } from "./tools/research-updates-schema";

export const toolNameSchema = z.enum([
  "getWeather",
  "createDocument",
  "updateDocument",
  "requestSuggestions",
  "readDocument",
  "retrieve",
  "webSearch",
  "codeInterpreter",
  "generateImage",
  "deepResearch",
]);

const _ = toolNameSchema.options satisfies ToolName[];

type ToolNameInternal = z.infer<typeof toolNameSchema>;

export const frontendToolsSchema = z.enum([
  "webSearch",
  "deepResearch",
  "generateImage",
  "createDocument",
]);

const __ = frontendToolsSchema.options satisfies ToolNameInternal[];

export type UiToolName = z.infer<typeof frontendToolsSchema>;
export const messageMetadataSchema = z.object({
  createdAt: z.date(),
  parentMessageId: z.string().nullable(),
  selectedModel: z.custom<AppModelId>((val) => typeof val === "string"),
  isPartial: z.boolean().optional(),
  selectedTool: frontendToolsSchema.optional(),
  usage: z.custom<LanguageModelUsage | undefined>((_val) => true).optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;
type deepResearchTool = InferUITool<ReturnType<typeof deepResearch>>;
type readDocumentTool = InferUITool<ReturnType<typeof readDocument>>;
type generateImageTool = InferUITool<ReturnType<typeof generateImage>>;
type webSearchTool = InferUITool<ReturnType<typeof tavilyWebSearch>>;
type codeInterpreterTool = InferUITool<typeof codeInterpreter>;
type retrieveTool = InferUITool<typeof retrieve>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
  deepResearch: deepResearchTool;
  readDocument: readDocumentTool;
  generateImage: generateImageTool;
  webSearch: webSearchTool;
  codeInterpreter: codeInterpreterTool;
  retrieve: retrieveTool;
};

type FollowupSuggestions = {
  suggestions: string[];
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  messageId: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  chatConfirmed: {
    chatId: string;
  };
  researchUpdate: ResearchUpdate;
  followupSuggestions: FollowupSuggestions;
};

export type ChatMessage = Omit<
  UIMessage<MessageMetadata, CustomUIDataTypes, ChatTools>,
  "metadata"
> & {
  metadata: MessageMetadata;
};

export type ToolName = keyof ChatTools;

export type StreamWriter = UIMessageStreamWriter<ChatMessage>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
