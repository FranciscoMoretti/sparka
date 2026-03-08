import type { InferUITool } from "ai";
import { tools } from "./plugins";

export const pluginTools = tools;

// Derive UI tool types automatically from the registered tools.
// When the CLI adds an entry to tools in plugins/index.ts, its typed input/output
// automatically flows into ChatTools via the PluginTools intersection.
export type PluginTools = {
  [K in keyof typeof pluginTools]: InferUITool<(typeof pluginTools)[K]>;
};
