import type {
  InferUITool,
  LanguageModelUsage,
  UIMessage,
  UIMessageStreamWriter,
} from "ai";
import { z } from "zod";
import type { codeExecution } from "@/lib/ai/tools/code-execution";
import type { deepResearch } from "@/lib/ai/tools/deep-research/deep-research";
import type { generateImageTool as generateImageToolFactory } from "@/lib/ai/tools/generate-image";
import type { generateVideoTool as generateVideoToolFactory } from "@/lib/ai/tools/generate-video";
import type { getWeather } from "@/lib/ai/tools/get-weather";
import type { readDocument } from "@/lib/ai/tools/read-document";
import type { retrieveUrl } from "@/lib/ai/tools/retrieve-url";
import type { tavilyWebSearch } from "@/lib/ai/tools/web-search";
import type { AppModelId } from "./app-models";
import type { InstalledTools } from "./installed-tools";
import type { createCodeDocumentTool } from "./tools/documents/create-code-document";
import type { createSheetDocumentTool } from "./tools/documents/create-sheet-document";
import type { createTextDocumentTool } from "./tools/documents/create-text-document";
import type { editCodeDocumentTool } from "./tools/documents/edit-code-document";
import type { editSheetDocumentTool } from "./tools/documents/edit-sheet-document";
import type { editTextDocumentTool } from "./tools/documents/edit-text-document";
import type { ResearchUpdate } from "./tools/research-updates-schema";

export const toolNameSchema = z.enum([
  "getWeather",
  "createTextDocument",
  "createCodeDocument",
  "createSheetDocument",
  "editTextDocument",
  "editCodeDocument",
  "editSheetDocument",
  "readDocument",
  "retrieveUrl",
  "webSearch",
  "codeExecution",
  "generateImage",
  "generateVideo",
  "deepResearch",
]);

const _ = toolNameSchema.options satisfies ToolName[];

type ToolNameInternal = z.infer<typeof toolNameSchema>;

const frontendToolsSchema = z.enum([
  "webSearch",
  "deepResearch",
  "generateImage",
  "generateVideo",
  "createTextDocument",
  "createCodeDocument",
  "createSheetDocument",
  "editTextDocument",
  "editCodeDocument",
  "editSheetDocument",
]);

const __ = frontendToolsSchema.options satisfies ToolNameInternal[];

export type UiToolName = z.infer<typeof frontendToolsSchema>;
const messageMetadataSchema = z.object({
  createdAt: z.date(),
  parentMessageId: z.string().nullable(),
  selectedModel: z.custom<AppModelId>((val) => typeof val === "string"),
  activeStreamId: z.string().nullable(),
  selectedTool: frontendToolsSchema.optional(),
  usage: z.custom<LanguageModelUsage | undefined>((_val) => true).optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createTextDocumentToolType = InferUITool<
  ReturnType<typeof createTextDocumentTool>
>;
type createCodeDocumentToolType = InferUITool<
  ReturnType<typeof createCodeDocumentTool>
>;
type createSheetDocumentToolType = InferUITool<
  ReturnType<typeof createSheetDocumentTool>
>;
type editTextDocumentToolType = InferUITool<
  ReturnType<typeof editTextDocumentTool>
>;
type editCodeDocumentToolType = InferUITool<
  ReturnType<typeof editCodeDocumentTool>
>;
type editSheetDocumentToolType = InferUITool<
  ReturnType<typeof editSheetDocumentTool>
>;
type deepResearchTool = InferUITool<ReturnType<typeof deepResearch>>;
type readDocumentTool = InferUITool<ReturnType<typeof readDocument>>;
type generateImageTool = InferUITool<
  ReturnType<typeof generateImageToolFactory>
>;
type generateVideoTool = InferUITool<
  ReturnType<typeof generateVideoToolFactory>
>;
type webSearchTool = InferUITool<ReturnType<typeof tavilyWebSearch>>;
type codeExecutionTool = InferUITool<ReturnType<typeof codeExecution>>;
type retrieveUrlTool = InferUITool<typeof retrieveUrl>;

// biome-ignore lint/style/useConsistentTypeDefinitions: using type for mapped type compatibility
export type ChatTools = {
  codeExecution: codeExecutionTool;
  createCodeDocument: createCodeDocumentToolType;
  createSheetDocument: createSheetDocumentToolType;
  createTextDocument: createTextDocumentToolType;
  deepResearch: deepResearchTool;
  editCodeDocument: editCodeDocumentToolType;
  editSheetDocument: editSheetDocumentToolType;
  editTextDocument: editTextDocumentToolType;
  generateImage: generateImageTool;
  generateVideo: generateVideoTool;
  getWeather: weatherTool;
  readDocument: readDocumentTool;
  retrieveUrl: retrieveUrlTool;
  webSearch: webSearchTool;
} & InstalledTools;

interface FollowupSuggestions {
  suggestions: string[];
}

// biome-ignore lint/style/useConsistentTypeDefinitions: using type for mapped type compatibility
export type CustomUIDataTypes = {
  appendMessage: string;
  chatConfirmed: {
    chatId: string;
  };
  followupSuggestions: FollowupSuggestions;
  researchUpdate: ResearchUpdate;
};

export type ChatMessage = Omit<
  UIMessage<MessageMetadata, CustomUIDataTypes, ChatTools>,
  "metadata"
> & {
  metadata: MessageMetadata;
};

export type ToolName = keyof ChatTools;

export type ToolOutput<T extends ToolName> = ChatTools[T]["output"];

export type StreamWriter = UIMessageStreamWriter<ChatMessage>;

export interface Attachment {
  contentType: string;
  name: string;
  url: string;
}
