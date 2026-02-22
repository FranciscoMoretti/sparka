import type { ConfigInput } from "@/lib/config-schema";

const isProd = process.env.NODE_ENV === "production";

/**
 * ChatJS Configuration
 *
 * Edit this file to customize your app.
 * @see https://chatjs.dev/docs/reference/config
 */
const config = {
  appPrefix: "chatjs",
  appName: "ChatJS",
  appTitle: "ChatJS - The prod ready AI chat app",
  appDescription:
    "Build and deploy AI chat applications in minutes. ChatJS provides authentication, streaming, tool calling, and all the features you need for production-ready AI conversations.",
  appUrl: "https://chatjs.dev",
  organization: {
    name: "ChatJS",
    contact: {
      privacyEmail: "privacy@chatjs.dev",
      legalEmail: "legal@chatjs.dev",
    },
  },
  services: {
    hosting: "Vercel",
    aiProviders: [
      "OpenAI",
      "Anthropic",
      "xAI",
      "Google",
      "Meta",
      "Mistral",
      "Alibaba",
      "Amazon",
      "Cohere",
      "DeepSeek",
      "Perplexity",
      "Vercel",
      "Inception",
      "Moonshot",
      "Morph",
      "ZAI",
    ],
    paymentProcessors: [],
  },
  features: {
    attachments: true, // Requires BLOB_READ_WRITE_TOKEN
  },
  legal: {
    minimumAge: 13,
    governingLaw: "United States",
    refundPolicy: "no-refunds",
  },
  policies: {
    privacy: {
      title: "Privacy Policy",
      lastUpdated: "July 24, 2025",
    },
    terms: {
      title: "Terms of Service",
      lastUpdated: "July 24, 2025",
    },
  },
  authentication: {
    google: true, // Requires AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET
    github: true, // Requires AUTH_GITHUB_ID + AUTH_GITHUB_SECRET
    vercel: true, // Requires VERCEL_APP_CLIENT_ID + VERCEL_APP_CLIENT_SECRET
  },
  ai: {
    gateway: "vercel",
    providerOrder: ["openai", "google", "anthropic", "xai"],
    disabledModels: ["morph/morph-v3-large", "morph/morph-v3-fast"],
    curatedDefaults: [
      // OpenAI
      "openai/gpt-5-nano",
      "openai/gpt-5-mini",
      "openai/gpt-5.2",
      "openai/gpt-5.2-chat",
      // Google
      "google/gemini-2.5-flash-lite",
      "google/gemini-3-flash",
      "google/gemini-3-pro-preview",
      // Anthropic
      "anthropic/claude-sonnet-4.5",
      "anthropic/claude-opus-4.5",
      // xAI
      "xai/grok-4",
    ],
    anonymousModels: [
      "google/gemini-2.5-flash-lite",
      "openai/gpt-5-mini",
      "openai/gpt-5-nano",
      "anthropic/claude-haiku-4.5",
    ],
    workflows: {
      chat: "openai/gpt-5-mini",
      title: "openai/gpt-5-nano",
      pdf: "openai/gpt-5-mini",
      chatImageCompatible: "openai/gpt-4o-mini",
    },
    tools: {
      webSearch: {
        enabled: true, // Requires TAVILY_API_KEY or FIRECRAWL_API_KEY
      },
      urlRetrieval: {
        enabled: true, // Requires FIRECRAWL_API_KEY
      },
      codeExecution: {
        enabled: true, // Vercel-native, no key needed
      },
      mcp: {
        enabled: true, // Requires MCP_ENCRYPTION_KEY
      },
      followupSuggestions: {
        enabled: true,
        default: "openai/gpt-5-nano",
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
        enabled: true, // Requires BLOB_READ_WRITE_TOKEN
        default: "google/gemini-3-pro-image",
      },
      video: {
        enabled: true, // Requires BLOB_READ_WRITE_TOKEN
        default: "xai/grok-imagine-video",
      },
      deepResearch: {
        enabled: true, // Requires webSearch
        defaultModel: "google/gemini-2.5-flash-lite",
        finalReportModel: "google/gemini-3-flash",
        allowClarification: true,
        maxResearcherIterations: 1,
        maxConcurrentResearchUnits: 2,
        maxSearchQueries: 2,
      },
    },
  },
  anonymous: {
    credits: isProd ? 10 : 1000,
    availableTools: [],
    rateLimit: {
      requestsPerMinute: isProd ? 5 : 60,
      requestsPerMonth: isProd ? 10 : 1000,
    },
  },
  attachments: {
    maxBytes: 1024 * 1024, // 1MB
    maxDimension: 2048,
    acceptedTypes: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "application/pdf": [".pdf"],
    },
  },
} satisfies ConfigInput;

export default config;
