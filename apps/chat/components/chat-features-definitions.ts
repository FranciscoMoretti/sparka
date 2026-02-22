import {
  Edit3,
  GlobeIcon,
  Images,
  type LucideIcon,
  Telescope,
  Video,
} from "lucide-react";
import type { UiToolName } from "@/lib/ai/types";
import { config } from "@/lib/config";

type ToolDefinition = {
  name: string;
  icon: LucideIcon;
  shortName: string;
};

export const toolDefinitions: Record<UiToolName, ToolDefinition> = {
  webSearch: { name: "Web Search", icon: GlobeIcon, shortName: "Search" },
  deepResearch: {
    name: "Deep Research",
    icon: Telescope,
    shortName: "Research",
  },
  generateImage: { name: "Create an image", icon: Images, shortName: "Image" },
  generateVideo: { name: "Create a video", icon: Video, shortName: "Video" },
  createTextDocument: { name: "Canvas", icon: Edit3, shortName: "Canvas" },
  createCodeDocument: { name: "Canvas", icon: Edit3, shortName: "Canvas" },
  createSheetDocument: { name: "Canvas", icon: Edit3, shortName: "Canvas" },
  editTextDocument: { name: "Canvas", icon: Edit3, shortName: "Canvas" },
  editCodeDocument: { name: "Canvas", icon: Edit3, shortName: "Canvas" },
  editSheetDocument: { name: "Canvas", icon: Edit3, shortName: "Canvas" },
};

/**
 * Tools enabled in the UI based on integration config.
 * Mirrors the conditional logic in lib/ai/tools/tools.ts
 */
export const enabledTools: UiToolName[] = [
  // Canvas tools are always available
  "createTextDocument",
  // Web search tool
  ...(config.ai.tools.webSearch.enabled ? (["webSearch"] as const) : []),
  // Deep research tool
  ...(config.ai.tools.deepResearch.enabled ? (["deepResearch"] as const) : []),
  // Image generation requires imageGeneration integration
  ...(config.ai.tools.image.enabled ? (["generateImage"] as const) : []),
  ...(config.ai.tools.video.enabled ? (["generateVideo"] as const) : []),
];
