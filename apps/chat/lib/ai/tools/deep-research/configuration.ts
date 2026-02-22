import { config } from "@/lib/config";
import { env } from "@/lib/env";

export type SearchAPI = "firecrawl" | "tavily" | "none";

export type DeepResearchRuntimeConfig = {
  // General Configuration
  max_structured_output_retries: number;
  allow_clarification: boolean;
  max_concurrent_research_units: number;

  // Research Configuration
  search_api: SearchAPI;
  search_api_max_queries: number;
  max_researcher_iterations: number;

  // Model Configuration
  summarization_model: string;
  summarization_model_max_tokens: number;
  research_model: string;
  research_model_max_tokens: number;
  compression_model: string;
  compression_model_max_tokens: number;
  final_report_model: string;
  final_report_model_max_tokens: number;
  status_update_model: string;
  status_update_model_max_tokens: number;

  // MCP server configuration (not yet implemented)
  mcp_config?: {
    url?: string;
    tools?: string[];
    headers?: Record<string, string>;
  };
  mcp_prompt?: string;
};

function getSearchApi(): SearchAPI {
  if (env.TAVILY_API_KEY) {
    return "tavily";
  }
  if (env.FIRECRAWL_API_KEY) {
    return "firecrawl";
  }
  return "none";
}

export function getDeepResearchConfig(): DeepResearchRuntimeConfig {
  const {
    defaultModel,
    finalReportModel,
    allowClarification,
    maxConcurrentResearchUnits,
    maxSearchQueries,
    maxResearcherIterations,
  } = config.ai.tools.deepResearch;

  return {
    // General Configuration
    max_structured_output_retries: 3,
    allow_clarification: allowClarification,
    max_concurrent_research_units: maxConcurrentResearchUnits,

    // Research Configuration
    search_api: getSearchApi(),
    search_api_max_queries: maxSearchQueries,
    max_researcher_iterations: maxResearcherIterations,

    // Model Configuration - use same model for research/compression/summarization
    summarization_model: defaultModel,
    summarization_model_max_tokens: 4000,
    research_model: defaultModel,
    research_model_max_tokens: 4000,
    compression_model: defaultModel,
    compression_model_max_tokens: 4000,
    final_report_model: finalReportModel,
    final_report_model_max_tokens: 6000,
    status_update_model: defaultModel,
    status_update_model_max_tokens: 4000,
  };
}
