import FirecrawlApp, { type SearchParams } from "@mendable/firecrawl-js";
import { type TavilySearchOptions, tavily } from "@tavily/core";
import { env } from "@/lib/env";
import { createModuleLogger } from "../../../logger";
import type { StreamWriter } from "../../types";

export type SearchProvider = "tavily" | "firecrawl";

export type SearchProviderOptions =
  | ({
      provider: "tavily";
    } & Omit<TavilySearchOptions, "limit">)
  | ({
      provider: "firecrawl";
    } & SearchParams);

export type WebSearchResult = {
  source: "web";
  title: string;
  url: string;
  content: string;
};

export type WebSearchResponse = {
  results: WebSearchResult[];
  error?: string;
};

// Initialize search providers lazily to avoid runtime errors when keys are missing
const tvly = env.TAVILY_API_KEY ? tavily({ apiKey: env.TAVILY_API_KEY }) : null;
const firecrawl = env.FIRECRAWL_API_KEY
  ? new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY })
  : null;

const log = createModuleLogger("tools/steps/web-search");

async function performTavilySearch(
  query: string,
  maxResults: number,
  providerOptions: SearchProviderOptions & { provider: "tavily" }
): Promise<WebSearchResult[]> {
  if (!tvly) {
    throw new Error(
      "Tavily is not configured. Set TAVILY_API_KEY or choose a different provider."
    );
  }
  const response = await tvly.search(query, {
    searchDepth: providerOptions.searchDepth || "basic",
    maxResults,
    includeAnswer: true,
    ...providerOptions,
  });

  return response.results.map((r) => ({
    source: "web" as const,
    title: r.title,
    url: r.url,
    content: r.content,
  }));
}

async function performFirecrawlSearch(
  query: string,
  maxResults: number,
  providerOptions: SearchProviderOptions & { provider: "firecrawl" }
): Promise<WebSearchResult[]> {
  if (!firecrawl) {
    throw new Error(
      "Firecrawl is not configured. Set FIRECRAWL_API_KEY or choose a different provider."
    );
  }
  const response = await firecrawl.search(query, {
    timeout: providerOptions.timeout || 15_000,
    limit: maxResults,
    scrapeOptions: { formats: ["markdown"] },
    ...providerOptions,
  });

  return response.data.map((item) => ({
    source: "web" as const,
    title: item.title || "",
    url: item.url || "",
    content: item.markdown || "",
  }));
}

function extractErrorDetails(error: unknown): {
  message: string | undefined;
  stack: string | undefined;
  status: number | undefined;
  data: unknown;
} {
  let message: string | undefined;
  let stack: string | undefined;
  let status: number | undefined;
  let data: unknown;

  if (typeof error === "object" && error !== null) {
    if (
      "message" in error &&
      typeof (error as { message: unknown }).message === "string"
    ) {
      message = (error as { message: string }).message;
    }
    if (
      "stack" in error &&
      typeof (error as { stack: unknown }).stack === "string"
    ) {
      stack = (error as { stack: string }).stack;
    }
    const maybeResp = (
      error as { response?: { status?: number; data?: unknown } }
    ).response;
    if (maybeResp) {
      status = maybeResp.status;
      data = maybeResp.data;
    }
  }

  return { message, stack, status, data };
}

export async function webSearchStep({
  query,
  maxResults,
  providerOptions,
  dataStream: _dataStream,
}: {
  query: string;
  maxResults: number;
  dataStream: StreamWriter;
  providerOptions: SearchProviderOptions;
}): Promise<WebSearchResponse> {
  try {
    const results =
      providerOptions.provider === "tavily"
        ? await performTavilySearch(query, maxResults, providerOptions)
        : await performFirecrawlSearch(query, maxResults, providerOptions);

    log.debug(
      { query, maxResults, provider: providerOptions.provider },
      "webSearchStep success"
    );
    return { results };
  } catch (error: unknown) {
    const { message, stack, status, data } = extractErrorDetails(error);

    log.error(
      {
        err: error,
        message,
        stack,
        status,
        data,
        query,
        providerOptions,
      },
      "Error in webSearchStep"
    );
    return {
      results: [],
      error: JSON.stringify(
        {
          message,
          status,
          data,
        },
        null,
        2
      ),
    };
  }
}
