import { tool } from "ai";
import { z } from "zod";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { createModuleLogger } from "../../logger";
import type { StreamWriter } from "../types";
import {
  type MultiQuerySearchOptions,
  multiQueryWebSearchStep,
} from "./steps/multi-query-web-search";
const COST_CENTS = 5; // Tavily API

const DEFAULT_MAX_RESULTS = 5;

const MAX_SEARCH_QUERIES = 2; // Tavily has a maximum of 2 queries per request
// Common search query schema
const searchQueriesSchema = z
  .array(
    z.object({
      query: z.string(),
      maxResults: z
        .number()
        .min(1)
        .max(10)
        .nullable()
        .describe(
          `Maximum number of results for this query. Defaults to ${DEFAULT_MAX_RESULTS}.`
        ),
    })
  )
  .max(MAX_SEARCH_QUERIES)
  .describe(`Array of search queries. Maximum ${MAX_SEARCH_QUERIES} queries.`);

// Common search execution logic
async function executeMultiQuerySearch({
  search_queries,
  options,
  dataStream,
  toolCallId,
  writeTopLevelUpdates,
  title,
  completeTitle,
}: {
  search_queries: Array<{ query: string; maxResults: number }>;
  options: MultiQuerySearchOptions;
  dataStream: StreamWriter;
  toolCallId: string;
  writeTopLevelUpdates: boolean;
  title: string;
  completeTitle: string;
}) {
  const log = createModuleLogger("tools/web-search");
  log.debug(
    { queriesCount: search_queries.length, options },
    "executeMultiQuerySearch start"
  );
  if (writeTopLevelUpdates) {
    dataStream.write({
      type: "data-researchUpdate",
      data: {
        toolCallId,
        title,
        timestamp: Date.now(),
        type: "started",
      },
    });
  }

  let completedSteps = 0;
  const totalSteps = 1;

  const { searches: searchResults, error } = await multiQueryWebSearchStep({
    queries: search_queries,
    options,
    toolCallId,
    dataStream,
  });
  if (error) {
    log.error(
      { error, queriesCount: search_queries.length },
      "multiQueryWebSearchStep returned error"
    );
  }

  completedSteps += 1;
  if (writeTopLevelUpdates) {
    dataStream.write({
      type: "data-researchUpdate",
      data: {
        toolCallId,
        title: completeTitle,
        timestamp: Date.now(),
        type: "completed",
      },
    });
  }
  log.debug(
    { completedSteps, totalSteps, resultGroups: searchResults.length },
    "executeMultiQuerySearch complete"
  );
  return { searches: searchResults };
}

export const tavilyWebSearch = ({
  dataStream,
  writeTopLevelUpdates,
  costAccumulator,
  toolCallIdOverride,
}: {
  dataStream: StreamWriter;
  writeTopLevelUpdates: boolean;
  costAccumulator?: CostAccumulator;
  toolCallIdOverride?: string;
}) =>
  tool({
    description: `Multi-query web search (supports depth, topic & result limits). Always cite sources inline.

Use for:
- General information gathering via web search

Avoid:
- Pulling content from a single known URL (use retrieveUrl instead)`,
    inputSchema: z.object({
      search_queries: searchQueriesSchema,
      topics: z
        .array(z.enum(["general", "news"]))
        .describe("Array of topic types to search for.")
        .nullable(),
      searchDepth: z
        .enum(["basic", "advanced"])
        .describe('Search depth to use. Defaults to "basic".')
        .nullable(),
      exclude_domains: z
        .array(z.string())
        .describe("A list of domains to exclude from all search results.")
        .nullable(),
    }),
    execute: async (
      {
        search_queries,
        topics,
        searchDepth,
        exclude_domains,
      }: {
        search_queries: { query: string; maxResults: number | null }[];
        topics: ("general" | "news")[] | null;
        searchDepth: "basic" | "advanced" | null;
        exclude_domains: string[] | null;
      },
      { toolCallId: sdkToolCallId }: { toolCallId: string }
    ) => {
      const toolCallId = toolCallIdOverride ?? sdkToolCallId;
      const log = createModuleLogger("tools/web-search");
      log.debug(
        {
          queriesCount: search_queries.length,
          topics,
          searchDepth,
          exclude_domains,
        },
        "tavilyWebSearch.execute"
      );
      // Handle nullable arrays with defaults
      const safeTopics = topics ?? ["general"];
      const _safeSearchDepth = searchDepth ?? "basic";
      const safeExcludeDomains = exclude_domains ?? [];

      const result = await executeMultiQuerySearch({
        search_queries: search_queries.map((query) => ({
          query: query.query,
          maxResults: query.maxResults ?? DEFAULT_MAX_RESULTS,
        })),
        options: {
          baseProviderOptions: {
            provider: "tavily",
          },
          topics: safeTopics,
          excludeDomains: safeExcludeDomains,
        },
        dataStream,
        toolCallId,
        writeTopLevelUpdates,
        title: "Searching",
        completeTitle: "Search complete",
      });

      // Report API cost
      costAccumulator?.addAPICost("webSearch", COST_CENTS);

      return result;
    },
  });

export const firecrawlWebSearch = ({
  dataStream,
  writeTopLevelUpdates,
  costAccumulator,
  toolCallIdOverride,
}: {
  dataStream: StreamWriter;
  writeTopLevelUpdates: boolean;
  costAccumulator?: CostAccumulator;
  toolCallIdOverride?: string;
}) =>
  tool({
    description: `Multi-query web search using Firecrawl for enhanced content extraction. Always cite sources inline.

Use for:
- General information gathering via web search with detailed content extraction
- When you need high-quality markdown content from web pages

Avoid:
- Pulling content from a single known URL (use retrieveUrl instead)`,
    inputSchema: z.object({
      search_queries: searchQueriesSchema,
    }),
    execute: async (
      {
        search_queries,
      }: {
        search_queries: { query: string; maxResults: number | null }[];
      },
      { toolCallId: sdkToolCallId }: { toolCallId: string }
    ) => {
      const toolCallId = toolCallIdOverride ?? sdkToolCallId;
      const log = createModuleLogger("tools/web-search");
      log.debug(
        { queriesCount: search_queries.length },
        "firecrawlWebSearch.execute"
      );
      const result = await executeMultiQuerySearch({
        search_queries: search_queries.map((query) => ({
          query: query.query,
          maxResults: query.maxResults ?? DEFAULT_MAX_RESULTS,
        })),
        options: {
          baseProviderOptions: {
            provider: "firecrawl",
          },
        },
        dataStream,
        toolCallId,
        writeTopLevelUpdates,
        title: "Searching with Firecrawl",
        completeTitle: "Firecrawl search complete",
      });

      // Report API cost
      costAccumulator?.addAPICost("webSearch", COST_CENTS);

      return result;
    },
  });
