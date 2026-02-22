import type { GatewayType } from "./gateways/registry";

type ModelDefaults = {
  providerOrder: string[];
  disabledModels: string[];
  curatedDefaults: string[];
  anonymousModels: string[];
  workflows: {
    chat: string;
    title: string;
    pdf: string;
    chatImageCompatible: string;
  };
  tools: {
    webSearch: {
      enabled: boolean;
    };
    urlRetrieval: {
      enabled: boolean;
    };
    codeExecution: {
      enabled: boolean;
    };
    mcp: {
      enabled: boolean;
    };
    followupSuggestions: {
      enabled: boolean;
      default: string;
    };
    text: {
      polish: string;
    };
    sheet: {
      format: string;
      analyze: string;
    };
    code: {
      edits: string;
    };
    image: {
      enabled: boolean;
      default: string;
    };
    deepResearch: {
      enabled: boolean;
      defaultModel: string;
      finalReportModel: string;
      allowClarification: boolean;
      maxResearcherIterations: number;
      maxConcurrentResearchUnits: number;
      maxSearchQueries: number;
    };
  };
};

const multiProviderDefaults = {
  providerOrder: ["openai", "google", "anthropic"],
  disabledModels: [],
  curatedDefaults: [
    "openai/gpt-5-nano",
    "openai/gpt-5-mini",
    "openai/gpt-5.2",
    "openai/gpt-5.2-chat",
    "google/gemini-2.5-flash-lite",
    "google/gemini-3-flash",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-opus-4.5",
    "xai/grok-4",
  ],
  anonymousModels: ["google/gemini-2.5-flash-lite", "openai/gpt-5-nano"],
  workflows: {
    chat: "openai/gpt-5-mini",
    title: "openai/gpt-5-nano",
    pdf: "openai/gpt-5-mini",
    chatImageCompatible: "openai/gpt-4o-mini",
  },
  tools: {
    webSearch: {
      enabled: false,
    },
    urlRetrieval: {
      enabled: false,
    },
    codeExecution: {
      enabled: false,
    },
    mcp: {
      enabled: false,
    },
    followupSuggestions: {
      enabled: false,
      default: "google/gemini-2.5-flash-lite",
    },
    text: {
      polish: "openai/gpt-5-mini",
    },
    sheet: {
      format: "openai/gpt-5-mini",
      analyze: "openai/gpt-5-mini",
    },
    code: {
      edits: "openai/gpt-5-mini",
    },
    image: {
      enabled: false,
      default: "google/gemini-3-pro-image",
    },
    deepResearch: {
      enabled: false,
      defaultModel: "google/gemini-2.5-flash-lite",
      finalReportModel: "google/gemini-3-flash",
      allowClarification: true,
      maxResearcherIterations: 1,
      maxConcurrentResearchUnits: 2,
      maxSearchQueries: 2,
    },
  },
} satisfies ModelDefaults;

const openaiOnlyDefaults = {
  providerOrder: ["openai"],
  disabledModels: [],
  curatedDefaults: [
    "gpt-5-nano",
    "gpt-5-mini",
    "gpt-5.2",
    "gpt-5.2-chat-latest",
  ],
  anonymousModels: ["gpt-5-nano"],
  workflows: {
    chat: "gpt-5-mini",
    title: "gpt-5-nano",
    pdf: "gpt-5-mini",
    chatImageCompatible: "gpt-4o-mini",
  },
  tools: {
    webSearch: {
      enabled: false,
    },
    urlRetrieval: {
      enabled: false,
    },
    codeExecution: {
      enabled: false,
    },
    mcp: {
      enabled: false,
    },
    followupSuggestions: {
      enabled: false,
      default: "gpt-5-nano",
    },
    text: {
      polish: "gpt-5-mini",
    },
    sheet: {
      format: "gpt-5-mini",
      analyze: "gpt-5-mini",
    },
    code: {
      edits: "gpt-5-mini",
    },
    image: {
      enabled: false,
      default: "gpt-image-1",
    },
    deepResearch: {
      enabled: false,
      defaultModel: "gpt-5-nano",
      finalReportModel: "gpt-5-mini",
      allowClarification: true,
      maxResearcherIterations: 1,
      maxConcurrentResearchUnits: 2,
      maxSearchQueries: 2,
    },
  },
} satisfies ModelDefaults;

export const GATEWAY_MODEL_DEFAULTS: Record<GatewayType, ModelDefaults> = {
  vercel: multiProviderDefaults,
  openrouter: multiProviderDefaults,
  openai: openaiOnlyDefaults,
  "openai-compatible": openaiOnlyDefaults,
};
