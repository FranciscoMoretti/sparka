import { type ToolName, toolNameSchema } from "../types";

// Tool costs in CENTS (external API fees only)
// LLM costs are calculated separately from token usage
export const toolsDefinitions: Record<ToolName, ToolDefinition> = {
  getWeather: {
    name: "getWeather",
    description: "Get the weather in a specific location",
    cost: 0, // internal
  },
  createTextDocument: {
    name: "createTextDocument",
    description: "Create a text document",
    cost: 0, // internal
  },
  createCodeDocument: {
    name: "createCodeDocument",
    description: "Create a code document",
    cost: 0, // internal
  },
  createSheetDocument: {
    name: "createSheetDocument",
    description: "Create a spreadsheet",
    cost: 0, // internal
  },
  editTextDocument: {
    name: "editTextDocument",
    description: "Edit a text document",
    cost: 0, // internal
  },
  editCodeDocument: {
    name: "editCodeDocument",
    description: "Edit a code document",
    cost: 0, // internal
  },
  editSheetDocument: {
    name: "editSheetDocument",
    description: "Edit a spreadsheet",
    cost: 0, // internal
  },
  readDocument: {
    name: "readDocument",
    description: "Read the content of a document",
    cost: 0, // internal
  },
  retrieveUrl: {
    name: "retrieveUrl",
    description: "Retrieve information from a URL",
    cost: 0, // internal
  },
  webSearch: {
    name: "webSearch",
    description: "Search the web",
    cost: 5, // Tavily API ~5¢
  },
  codeExecution: {
    name: "codeExecution",
    description: "Execute code in a virtual environment",
    cost: 5, // Vercel Sandbox execution ~5¢
  },
  generateImage: {
    name: "generateImage",
    description: "Generate images from text descriptions",
    cost: 0, // LLM cost tracked via token usage
  },
  generateVideo: {
    name: "generateVideo",
    description: "Generate video clips from text descriptions",
    cost: 0, // LLM cost tracked via token usage
  },
  deepResearch: {
    name: "deepResearch",
    description: "Research a topic",
    cost: 0, // LLM calls tracked via usage, Tavily calls counted separately
  },
  wordCount: {
    name: "wordCount",
    description: "Count the words, characters, and sentences in a given text",
    cost: 0, // internal
  },
};

export const allTools = toolNameSchema.options;
interface ToolDefinition {
  cost: number;
  description: string;
  name: string;
}
