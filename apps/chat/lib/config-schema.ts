import { z } from "zod";
import type {
  GatewayImageModelIdMap,
  GatewayModelIdMap,
  GatewayType,
  GatewayVideoModelIdMap,
} from "@/lib/ai/gateways/registry";
import type { ToolName } from "./ai/types";

const DEFAULT_GATEWAY = "vercel" as const satisfies GatewayType;

// Helper to create typed model ID schemas
const toolName = () => z.custom<ToolName>();

// =====================================================
// AI config — discriminated union keyed on gateway
// =====================================================

function gatewayModelId<G extends GatewayType>() {
  return z.custom<GatewayModelIdMap[G]>((v) => typeof v === "string");
}

function gatewayImageModelId<G extends GatewayType>() {
  return z.custom<GatewayImageModelIdMap[G]>((v) => typeof v === "string");
}

function gatewayVideoModelId<G extends GatewayType>() {
  return z.custom<GatewayVideoModelIdMap[G]>((v) => typeof v === "string");
}

const deepResearchToolConfigSchema = z
  .object({
    defaultModel: z.string(),
    finalReportModel: z.string(),
    allowClarification: z
      .boolean()
      .describe("Whether to ask clarifying questions before starting research"),
    maxResearcherIterations: z
      .number()
      .int()
      .min(1)
      .max(10)
      .describe("Maximum supervisor loop iterations"),
    maxConcurrentResearchUnits: z
      .number()
      .int()
      .min(1)
      .max(20)
      .describe("Topics researched in parallel per iteration"),
    maxSearchQueries: z
      .number()
      .int()
      .min(1)
      .max(10)
      .describe("Max search queries per research topic"),
  });

function createAiSchema<G extends GatewayType>(g: G) {
  return z.object({
    gateway: z.literal(g),
    providerOrder: z
      .array(z.string())
      .describe("Provider sort order in model selector"),
    disabledModels: z
      .array(gatewayModelId<G>())
      .describe("Models to hide from all users"),
    curatedDefaults: z
      .array(gatewayModelId<G>())
      .describe("Default models enabled for new users"),
    anonymousModels: z
      .array(gatewayModelId<G>())
      .describe("Models available to anonymous users"),
    workflows: z
      .object({
        chat: gatewayModelId<G>(),
        title: gatewayModelId<G>(),
        pdf: gatewayModelId<G>(),
        chatImageCompatible: gatewayModelId<G>(),
      })
      .describe("Default model for shared app workflows"),
    tools: z
      .object({
        webSearch: z.object({
          enabled: z.boolean(),
        }),
        urlRetrieval: z.object({
          enabled: z.boolean(),
        }),
        codeExecution: z.object({
          enabled: z.boolean(),
        }),
        mcp: z.object({
          enabled: z.boolean(),
        }),
        followupSuggestions: z.object({
          enabled: z.boolean(),
          default: gatewayModelId<G>(),
        }),
        text: z.object({
          polish: gatewayModelId<G>(),
        }),
        sheet: z.object({
          format: gatewayModelId<G>(),
          analyze: gatewayModelId<G>(),
        }),
        code: z.object({
          edits: gatewayModelId<G>(),
        }),
        image: z.object({
          enabled: z.boolean(),
          default: gatewayImageModelId<G>(),
        }),
        video: z.object({
          enabled: z.boolean(),
          default: gatewayVideoModelId<G>(),
        }),
        deepResearch: deepResearchToolConfigSchema.extend({
          enabled: z.boolean(),
          defaultModel: gatewayModelId<G>(),
          finalReportModel: gatewayModelId<G>(),
        }),
      })
      .describe("Default model and runtime configuration grouped by tool"),
  });
}

// Record ensures a compile error if a new gateway is added but not here.
const gatewaySchemaMap: {
  [G in GatewayType]: ReturnType<typeof createAiSchema<G>>;
} = {
  vercel: createAiSchema("vercel"),
  openrouter: createAiSchema("openrouter"),
  openai: createAiSchema("openai"),
  "openai-compatible": createAiSchema("openai-compatible"),
};

export const aiConfigSchema = z
  .discriminatedUnion("gateway", [
    gatewaySchemaMap.vercel,
    gatewaySchemaMap.openrouter,
    gatewaySchemaMap.openai,
    gatewaySchemaMap["openai-compatible"],
  ])
  .default({
    gateway: DEFAULT_GATEWAY,
    providerOrder: ["openai", "google", "anthropic"],
    disabledModels: [],
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
      video: {
        enabled: false,
        default: "xai/grok-imagine-video",
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
  });

export const pricingConfigSchema = z.object({
  currency: z.string().optional(),
  free: z
    .object({
      name: z.string(),
      summary: z.string(),
    })
    .optional(),
  pro: z
    .object({
      name: z.string(),
      monthlyPrice: z.number(),
      summary: z.string(),
    })
    .optional(),
});

export const anonymousConfigSchema = z
  .object({
    credits: z.number().describe("Message credits for anonymous users"),
    availableTools: z
      .array(toolName())
      .describe("Tools available to anonymous users"),
    rateLimit: z
      .object({
        requestsPerMinute: z.number(),
        requestsPerMonth: z.number(),
      })
      .describe("Rate limits"),
  })
  .default({
    credits: 10,
    availableTools: [],
    rateLimit: {
      requestsPerMinute: 5,
      requestsPerMonth: 10,
    },
  });

export const attachmentsConfigSchema = z
  .object({
    maxBytes: z.number().describe("Max file size in bytes after compression"),
    maxDimension: z.number().describe("Max image dimension"),
    acceptedTypes: z
      .object({
        "image/png": z.array(z.string()),
        "image/jpeg": z.array(z.string()),
        "application/pdf": z.array(z.string()),
      })
      .describe("Accepted MIME types with their file extensions"),
  })
  .default({
    maxBytes: 1024 * 1024,
    maxDimension: 2048,
    acceptedTypes: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "application/pdf": [".pdf"],
    },
  });

export const featuresConfigSchema = z
  .object({
    attachments: z
      .boolean()
      .describe("File attachments (requires BLOB_READ_WRITE_TOKEN)"),
  })
  .default({
    attachments: false,
  });

export const authenticationConfigSchema = z
  .object({
    google: z
      .boolean()
      .describe("Google OAuth (requires AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET)"),
    github: z
      .boolean()
      .describe("GitHub OAuth (requires AUTH_GITHUB_ID + AUTH_GITHUB_SECRET)"),
    vercel: z
      .boolean()
      .describe(
        "Vercel OAuth (requires VERCEL_APP_CLIENT_ID + VERCEL_APP_CLIENT_SECRET)"
      ),
  })
  .default({
    google: false,
    github: true,
    vercel: false,
  });

export const configSchema = z.object({
  appPrefix: z.string().default("chatjs"),
  appName: z.string().default("My AI Chat"),
  appTitle: z
    .string()
    .optional()
    .describe("Browser tab title (defaults to appName)"),
  appDescription: z.string().default("AI chat powered by ChatJS"),
  appUrl: z.url().default("https://your-domain.com"),

  organization: z
    .object({
      name: z.string(),
      contact: z.object({
        privacyEmail: z.string().email(),
        legalEmail: z.string().email(),
      }),
    })
    .default({
      name: "Your Organization",
      contact: {
        privacyEmail: "privacy@your-domain.com",
        legalEmail: "legal@your-domain.com",
      },
    }),

  services: z
    .object({
      hosting: z.string(),
      aiProviders: z.array(z.string()),
      paymentProcessors: z.array(z.string()),
    })
    .default({
      hosting: "Vercel",
      aiProviders: ["OpenAI", "Anthropic", "Google"],
      paymentProcessors: [],
    }),

  features: featuresConfigSchema,

  pricing: pricingConfigSchema.optional(),

  legal: z
    .object({
      minimumAge: z.number(),
      governingLaw: z.string(),
      refundPolicy: z.string(),
    })
    .default({
      minimumAge: 13,
      governingLaw: "United States",
      refundPolicy: "no-refunds",
    }),

  policies: z
    .object({
      privacy: z.object({
        title: z.string(),
        lastUpdated: z.string().optional(),
      }),
      terms: z.object({
        title: z.string(),
        lastUpdated: z.string().optional(),
      }),
    })
    .default({
      privacy: { title: "Privacy Policy" },
      terms: { title: "Terms of Service" },
    }),

  authentication: authenticationConfigSchema,

  ai: aiConfigSchema,

  anonymous: anonymousConfigSchema,

  attachments: attachmentsConfigSchema,

});

// Output types (after defaults applied)
export type Config = z.infer<typeof configSchema>;
export type PricingConfig = z.infer<typeof pricingConfigSchema>;
export type AiConfig = z.infer<typeof aiConfigSchema>;
export type AnonymousConfig = z.infer<typeof anonymousConfigSchema>;
export type AttachmentsConfig = z.infer<typeof attachmentsConfigSchema>;
export type FeaturesConfig = z.infer<typeof featuresConfigSchema>;
export type AuthenticationConfig = z.infer<typeof authenticationConfigSchema>;

// Gateway-aware input types: model IDs narrowed per gateway for autocomplete
type ZodConfigInput = z.input<typeof configSchema>;

// Use vercel variant as shape reference (all variants share the same structure)
type AiShape = z.input<typeof gatewaySchemaMap.vercel>;
type AiToolsShape = AiShape["tools"];
type DeepResearchToolInputFor<G extends GatewayType> = Omit<
  AiToolsShape["deepResearch"],
  "defaultModel" | "finalReportModel"
> & {
  defaultModel: GatewayModelIdMap[G];
  finalReportModel: GatewayModelIdMap[G];
};
type ImageToolInputFor<G extends GatewayType> = Omit<
  AiToolsShape["image"],
  "default"
> & {
  default: GatewayImageModelIdMap[G];
};
type VideoToolInputFor<G extends GatewayType> = Omit<
  AiToolsShape["video"],
  "default"
> & {
  default: GatewayVideoModelIdMap[G];
};
type FollowupSuggestionsToolInputFor<G extends GatewayType> = Omit<
  AiToolsShape["followupSuggestions"],
  "default"
> & {
  default: GatewayModelIdMap[G];
};
type AiToolsInputFor<G extends GatewayType> = {
  webSearch: AiToolsShape["webSearch"];
  urlRetrieval: AiToolsShape["urlRetrieval"];
  codeExecution: AiToolsShape["codeExecution"];
  mcp: AiToolsShape["mcp"];
  followupSuggestions: FollowupSuggestionsToolInputFor<G>;
  text: {
    [P in keyof AiToolsShape["text"]]: GatewayModelIdMap[G];
  };
  sheet: {
    [P in keyof AiToolsShape["sheet"]]: GatewayModelIdMap[G];
  };
  code: {
    [P in keyof AiToolsShape["code"]]: GatewayModelIdMap[G];
  };
  image: ImageToolInputFor<G>;
  video: VideoToolInputFor<G>;
  deepResearch: DeepResearchToolInputFor<G>;
};

type AiInputFor<G extends GatewayType> = {
  [K in keyof AiShape]: K extends "gateway"
    ? G
    : K extends "workflows"
      ? {
          [W in keyof AiShape["workflows"]]: GatewayModelIdMap[G];
        }
      : K extends "tools"
        ? AiToolsInputFor<G>
      : K extends "disabledModels" | "curatedDefaults" | "anonymousModels"
        ? GatewayModelIdMap[G][]
        : AiShape[K];
};

type ConfigInputForGateway<G extends GatewayType> = Omit<
  ZodConfigInput,
  "ai"
> & {
  ai?: AiInputFor<G>;
};

export type ConfigInput = {
  [G in GatewayType]: ConfigInputForGateway<G>;
}[GatewayType];

// Apply defaults to partial config
export function applyDefaults(input: ConfigInput): Config {
  return configSchema.parse(input);
}
