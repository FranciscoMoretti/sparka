import type { FileUIPart, ModelMessage, Tool } from "ai";
import { DEFAULT_IMAGE_MODEL, type ModelId } from "@/lib/ai/app-models";
import { getOrCreateMcpClient, type MCPClient } from "@/lib/ai/mcp/mcp-client";
import { createToolId } from "@/lib/ai/mcp-name-id";
import { codeInterpreter } from "@/lib/ai/tools/code-interpreter";
import { getCreateDocumentTool } from "@/lib/ai/tools/create-document";
import { generateImageTool } from "@/lib/ai/tools/generate-image";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { readDocument } from "@/lib/ai/tools/read-document";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { retrieve } from "@/lib/ai/tools/retrieve";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { tavilyWebSearch } from "@/lib/ai/tools/web-search";
import { siteConfig } from "@/lib/config";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import type { McpConnector } from "@/lib/db/schema";
import { createModuleLogger } from "@/lib/logger";
import type { StreamWriter } from "../types";
import { deepResearch } from "./deep-research/deep-research";
import type { ToolSession } from "./types";

const log = createModuleLogger("tools:mcp");

export type { ToolSession } from "./types";

export function getTools({
  dataStream,
  session,
  messageId,
  selectedModel,
  attachments = [],
  lastGeneratedImage = null,
  contextForLLM,
  costAccumulator,
}: {
  dataStream: StreamWriter;
  session: ToolSession;
  messageId: string;
  selectedModel: ModelId;
  attachments: FileUIPart[];
  lastGeneratedImage: { imageUrl: string; name: string } | null;
  contextForLLM: ModelMessage[];
  costAccumulator: CostAccumulator;
}) {
  return {
    getWeather,
    createDocument: getCreateDocumentTool({
      session,
      dataStream,
      contextForLLM,
      messageId,
      selectedModel,
      costAccumulator,
    }),
    updateDocument: updateDocument({
      session,
      dataStream,
      messageId,
      selectedModel,
      costAccumulator,
    }),
    requestSuggestions: requestSuggestions({
      session,
      dataStream,
    }),
    readDocument: readDocument({
      session,
      dataStream,
    }),
    // reasonSearch: createReasonSearch({
    //   session,
    //   dataStream,
    // }),
    retrieve,
    ...(siteConfig.integrations.webSearch
      ? {
          webSearch: tavilyWebSearch({
            dataStream,
            writeTopLevelUpdates: true,
            costAccumulator,
          }),
        }
      : {}),

    ...(siteConfig.integrations.sandbox
      ? { codeInterpreter: codeInterpreter({ costAccumulator }) }
      : {}),
    ...(siteConfig.integrations.openai
      ? {
          generateImage: generateImageTool({
            attachments,
            lastGeneratedImage,
            modelId: DEFAULT_IMAGE_MODEL,
            costAccumulator,
          }),
        }
      : {}),
    ...(siteConfig.integrations.webSearch
      ? {
          deepResearch: deepResearch({
            session,
            dataStream,
            messageId,
            messages: contextForLLM,
            costAccumulator,
          }),
        }
      : {}),
  };
}

/**
 * Creates MCP clients for the given connectors and returns their tools.
 * Uses OAuth-aware MCP clients that can authenticate with OAuth 2.1 + PKCE.
 * Returns both the tools and a cleanup function to close all clients.
 */
export async function getMcpTools({
  connectors,
}: {
  connectors: McpConnector[];
}): Promise<{
  tools: Record<string, Tool>;
  cleanup: () => Promise<void>;
}> {
  if (!siteConfig.integrations.mcp) {
    return {
      tools: {},
      cleanup: async () => Promise.resolve(),
    };
  }

  const enabledConnectors = connectors.filter((c) => c.enabled);

  if (enabledConnectors.length === 0) {
    return {
      tools: {},
      cleanup: async () => Promise.resolve(),
    };
  }

  const clients: MCPClient[] = [];
  const allTools: Record<string, Tool> = {};

  for (const connector of enabledConnectors) {
    try {
      // Get or create OAuth-aware MCP client
      const mcpClient = getOrCreateMcpClient({
        id: connector.id,
        name: connector.name,
        url: connector.url,
        type: connector.type,
        // Legacy Basic auth headers for connectors that have client credentials
        headers:
          connector.oauthClientId && connector.oauthClientSecret
            ? {
                Authorization: `Basic ${Buffer.from(`${connector.oauthClientId}:${connector.oauthClientSecret}`).toString("base64")}`,
              }
            : undefined,
      });

      // Attempt to connect
      await mcpClient.connect();

      // Skip connectors that need OAuth authorization
      if (mcpClient.status === "authorizing") {
        log.info(
          { connector: connector.name },
          "MCP connector needs OAuth authorization, skipping"
        );
        continue;
      }

      // Skip if not connected
      if (mcpClient.status !== "connected") {
        log.warn(
          { connector: connector.name, status: mcpClient.status },
          "MCP connector not connected, skipping"
        );
        continue;
      }

      clients.push(mcpClient);
      const tools = await mcpClient.tools();

      // Namespace tool names with connector nameId to avoid collisions
      // Format: {namespace}.{toolName} or global.{namespace}.{toolName}
      const isGlobal = connector.userId === null;
      for (const [toolName, tool] of Object.entries(tools)) {
        const toolId = createToolId(connector.nameId, toolName, isGlobal);
        allTools[toolId] = tool as Tool;
      }

      log.info(
        { connector: connector.name, toolCount: Object.keys(tools).length },
        "MCP client connected"
      );
    } catch (error) {
      log.error(
        { connector: connector.name, error },
        "Failed to connect to MCP server"
      );
      // Continue with other connectors even if one fails
    }
  }

  const cleanup = async () => {
    await Promise.all(
      clients.map(async (client) => {
        try {
          await client.close();
        } catch (error) {
          log.error({ error }, "Failed to close MCP client");
        }
      })
    );
  };

  return { tools: allTools, cleanup };
}
