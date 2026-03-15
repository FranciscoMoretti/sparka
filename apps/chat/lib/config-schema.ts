import { z } from "zod";
import type {
  GatewayImageModelIdMap,
  GatewayModelIdMap,
  GatewayType,
  GatewayVideoModelIdMap,
} from "@/lib/ai/gateways/registry";
import { GATEWAY_MODEL_DEFAULTS } from "./ai/gateway-model-defaults";
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

const deepResearchToolConfigSchema = z.object({
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
        image: z.discriminatedUnion("enabled", [
          z.object({
            enabled: z.literal(true),
            default: gatewayImageModelId<G>(),
          }),
          z.object({
            enabled: z.literal(false),
            default: gatewayImageModelId<G>().optional(),
          }),
        ]),
        video: z.discriminatedUnion("enabled", [
          z.object({
            enabled: z.literal(true),
            default: gatewayVideoModelId<G>(),
          }),
          z.object({
            enabled: z.literal(false),
            default: gatewayVideoModelId<G>().optional(),
          }),
        ]),
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
    ...GATEWAY_MODEL_DEFAULTS[DEFAULT_GATEWAY],
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
    parallelResponses: z
      .boolean()
      .default(true)
      .describe("Send one message to multiple models simultaneously"),
  })
  .default({
    attachments: false,
    parallelResponses: true,
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

// All helper types are Partial — fields not provided are filled by applyDefaults
type DeepResearchToolInputFor<G extends GatewayType> = Partial<
  Omit<AiToolsShape["deepResearch"], "defaultModel" | "finalReportModel"> & {
    defaultModel: GatewayModelIdMap[G];
    finalReportModel: GatewayModelIdMap[G];
  }
>;
type ImageToolInputFor<G extends GatewayType> = [
  GatewayImageModelIdMap[G],
] extends [never]
  ? { enabled?: false }
  :
      | { enabled: true; default: GatewayImageModelIdMap[G] }
      | { enabled?: false; default?: GatewayImageModelIdMap[G] };
type VideoToolInputFor<G extends GatewayType> = [
  GatewayVideoModelIdMap[G],
] extends [never]
  ? { enabled?: false }
  :
      | { enabled: true; default: GatewayVideoModelIdMap[G] }
      | { enabled?: false; default?: GatewayVideoModelIdMap[G] };
type FollowupSuggestionsToolInputFor<G extends GatewayType> = Partial<{
  enabled: boolean;
  default: GatewayModelIdMap[G];
}>;
interface AiToolsInputFor<G extends GatewayType> {
  code?: Partial<{ [P in keyof AiToolsShape["code"]]: GatewayModelIdMap[G] }>;
  codeExecution?: Partial<AiToolsShape["codeExecution"]>;
  deepResearch?: DeepResearchToolInputFor<G>;
  followupSuggestions?: FollowupSuggestionsToolInputFor<G>;
  image?: ImageToolInputFor<G>;
  mcp?: Partial<AiToolsShape["mcp"]>;
  sheet?: Partial<{ [P in keyof AiToolsShape["sheet"]]: GatewayModelIdMap[G] }>;
  text?: Partial<{ [P in keyof AiToolsShape["text"]]: GatewayModelIdMap[G] }>;
  urlRetrieval?: Partial<AiToolsShape["urlRetrieval"]>;
  video?: VideoToolInputFor<G>;
  webSearch?: Partial<AiToolsShape["webSearch"]>;
}

// Only gateway is required; everything else is an override on top of GATEWAY_MODEL_DEFAULTS
// biome-ignore lint/style/useConsistentTypeDefinitions: type is used intentionally here
type AiInputFor<G extends GatewayType> = {
  gateway: G;
  providerOrder?: AiShape["providerOrder"];
  disabledModels?: GatewayModelIdMap[G][];
  curatedDefaults?: GatewayModelIdMap[G][];
  anonymousModels?: GatewayModelIdMap[G][];
  workflows?: Partial<{
    [W in keyof AiShape["workflows"]]: GatewayModelIdMap[G];
  }>;
  tools?: AiToolsInputFor<G>;
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

/**
 * Type-safe config helper. Infers the gateway type from `ai.gateway` so
 * autocomplete and error messages are scoped to the chosen gateway's model IDs.
 * Only `ai.gateway` is required — all other `ai` fields are optional overrides
 * on top of the gateway defaults supplied by `applyDefaults`.
 */
export function defineConfig<G extends GatewayType>(
  config: ConfigInputForGateway<G>
): ConfigInput {
  return config as ConfigInput;
}

function mergeToolsConfig<T extends Record<string, unknown>>(
  defaults: T,
  user: Record<string, unknown> | undefined
): T {
  if (!user) {
    return defaults;
  }
  const result: Record<string, unknown> = { ...defaults };
  for (const [key, val] of Object.entries(user)) {
    const defVal = result[key];
    if (
      val !== null &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      defVal !== null &&
      typeof defVal === "object" &&
      !Array.isArray(defVal)
    ) {
      result[key] = { ...defVal, ...(val as object) };
    } else {
      result[key] = val;
    }
  }
  return result as T;
}

// Apply defaults to partial config
export function applyDefaults(input: ConfigInput): Config {
  const gateway = input.ai?.gateway ?? DEFAULT_GATEWAY;
  const gatewayDefaults = GATEWAY_MODEL_DEFAULTS[gateway];
  const aiInput = input.ai as Record<string, unknown> | undefined;

  const mergedAi = {
    gateway,
    ...gatewayDefaults,
    ...aiInput,
    workflows: {
      ...gatewayDefaults.workflows,
      ...(aiInput?.workflows as Record<string, unknown> | undefined),
    },
    tools: mergeToolsConfig(
      gatewayDefaults.tools,
      aiInput?.tools as Record<string, unknown> | undefined
    ),
  };

  return configSchema.parse({ ...input, ai: mergedAi });
}
