import type { FileUIPart, ModelMessage, Tool } from "ai";
import type { ModelId } from "@/lib/ai/app-models";
import { getOrCreateMcpClient, type MCPClient } from "@/lib/ai/mcp/mcp-client";
import { createToolId } from "@/lib/ai/mcp-name-id";
import { codeExecution } from "@/lib/ai/tools/code-execution";
import { createCodeDocumentTool } from "@/lib/ai/tools/documents/create-code-document";
import { createSheetDocumentTool } from "@/lib/ai/tools/documents/create-sheet-document";
import { createTextDocumentTool } from "@/lib/ai/tools/documents/create-text-document";
import { editCodeDocumentTool } from "@/lib/ai/tools/documents/edit-code-document";
import { editSheetDocumentTool } from "@/lib/ai/tools/documents/edit-sheet-document";
import { editTextDocumentTool } from "@/lib/ai/tools/documents/edit-text-document";
import { generateImageTool } from "@/lib/ai/tools/generate-image";
import { generateVideoTool } from "@/lib/ai/tools/generate-video";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { readDocument } from "@/lib/ai/tools/read-document";
import { retrieveUrl } from "@/lib/ai/tools/retrieve-url";
import { tavilyWebSearch } from "@/lib/ai/tools/web-search";
import { config } from "@/lib/config";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import type { McpConnector } from "@/lib/db/schema";
import { createModuleLogger } from "@/lib/logger";
import type { StreamWriter } from "../types";
import { deepResearch } from "./deep-research/deep-research";
import type { ToolSession } from "./types";

const log = createModuleLogger("tools:mcp");

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
  const documentToolProps = {
    session,
    messageId,
    selectedModel,
    costAccumulator,
  };

  return {
    getWeather,
    createTextDocument: createTextDocumentTool(documentToolProps),
    createCodeDocument: createCodeDocumentTool(documentToolProps),
    createSheetDocument: createSheetDocumentTool(documentToolProps),
    editTextDocument: editTextDocumentTool(documentToolProps),
    editCodeDocument: editCodeDocumentTool(documentToolProps),
    editSheetDocument: editSheetDocumentTool(documentToolProps),
    readDocument: readDocument({
      session,
      dataStream,
    }),
    ...(config.ai.tools.urlRetrieval.enabled ? { retrieveUrl } : {}),
    ...(config.ai.tools.webSearch.enabled
      ? {
          webSearch: tavilyWebSearch({
            dataStream,
            writeTopLevelUpdates: true,
            costAccumulator,
          }),
        }
      : {}),

    ...(config.ai.tools.codeExecution.enabled
      ? { codeExecution: codeExecution({ costAccumulator }) }
      : {}),
    ...(config.ai.tools.image.enabled
      ? {
          generateImage: generateImageTool({
            attachments,
            lastGeneratedImage,
            selectedModel,
            costAccumulator,
          }),
        }
      : {}),
    ...(config.ai.tools.deepResearch.enabled
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
    ...(config.ai.tools.video.enabled
      ? {
          generateVideo: generateVideoTool({
            selectedModel,
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
  if (!config.ai.tools.mcp.enabled) {
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
