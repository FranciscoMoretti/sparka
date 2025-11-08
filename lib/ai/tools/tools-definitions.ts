import { type ToolName, toolNameSchema } from "../types";

export const toolsDefinitions: Record<ToolName, ToolDefinition> = {
  getWeather: {
    name: "getWeather",
    description: "Get the weather in a specific location",
    cost: 1,
  },
  createDocument: {
    name: "createDocument",
    description: "Create a new document",
    cost: 5,
  },
  updateDocument: {
    name: "updateDocument",
    description: "Update a document",
    cost: 5,
  },
  requestSuggestions: {
    name: "requestSuggestions",
    description: "Request suggestions for a document",
    cost: 1,
  },
  readDocument: {
    name: "readDocument",
    description: "Read the content of a document",
    cost: 1,
  },
  // reasonSearch: {
  //   name: 'reasonSearch',
  //   description: 'Search with reasoning',
  //   cost: 50,
  // },
  retrieve: {
    name: "retrieve",
    description: "Retrieve information from the web",
    cost: 1,
  },
  webSearch: {
    name: "webSearch",
    description: "Search the web",
    cost: 3,
  },
  stockChart: {
    name: "stockChart",
    description: "Get the stock chart for a specific stock",
    cost: 1,
  },
  codeInterpreter: {
    name: "codeInterpreter",
    description: "Interpret code in a virtual environment",
    cost: 10,
  },
  generateImage: {
    name: "generateImage",
    description: "Generate images from text descriptions",
    cost: 50,
  },
  deepResearch: {
    name: "deepResearch",
    description: "Research a topic",
    cost: 50,
  },
  geminiRag: {
    name: "geminiRag",
    description: "Query Gemini RAG with current attachments; ephemeral store with immediate teardown",
    cost: 10,
  },
};

export const allTools = toolNameSchema.options;
export type ToolDefinition = {
  name: string;
  description: string;
  cost: number;
};
