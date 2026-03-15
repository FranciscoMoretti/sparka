import { defineConfig } from "@/lib/config-schema";

const isProd = process.env.NODE_ENV === "production";

/**
 * ChatJS Configuration
 *
 * Edit this file to customize your app.
 * @see https://chatjs.dev/docs/reference/config
 */
const config = defineConfig({
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
		parallelResponses: true,
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
		providerOrder: [
			"openai",
			"anthropic",
			"google",
			"xai",
			"meta",
			"mistral",
			"deepseek",
			"perplexity",
			"cohere",
			"alibaba",
			"amazon",
			"inception",
			"moonshot",
			"morph",
			"zai",
		],
		disabledModels: [],
		anonymousModels: ["openai/gpt-5-nano"],
		workflows: {
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
			deepResearch: {
				enabled: true, // Requires webSearch
				defaultModel: "openai/gpt-5-nano",
				finalReportModel: "openai/gpt-5-mini",
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
});

export default config;
