<div align="center">

<img src="public/icon.svg" alt="Sparka AI" width="64" height="64">

# Production-Ready AI Chat Template

Build your own multi-model AI chat app with 120+ models, authentication, streaming, and advanced features.

**Next.js • Vercel AI SDK • Shadcn/UI • Better Auth • Drizzle ORM**

[**Live Demo**](https://sparka.ai)

</div>

![sparka_gif_demo](https://github.com/user-attachments/assets/34a03eed-58fa-4b1e-b453-384351b1c08c)

Ship a full-featured AI chat in minutes with Claude, GPT-4, Gemini, Grok, and 120+ models through Vercel AI Gateway.

## Stack

- [Next.js 16](https://nextjs.org) - App Router, React Server Components
- [TypeScript](https://www.typescriptlang.org) - Full type safety
- [Vercel AI SDK v5](https://sdk.vercel.ai) - Unified AI provider integration with 120+ models
- [Better Auth](https://www.better-auth.com) - Authentication & authorization
- [Drizzle ORM](https://orm.drizzle.team) - Type-safe database queries
- [PostgreSQL](https://www.postgresql.org) - Primary database
- [Redis](https://redis.io) - Caching & resumable streams
- [Vercel Blob](https://vercel.com/storage/blob) - Blob storage
- [Shadcn/UI](https://ui.shadcn.com) - Beautiful, accessible components
- [Tailwind CSS 4](https://tailwindcss.com) - Styling
- [tRPC](https://trpc.io) - End-to-end type-safe APIs
- [Zod 4](https://zod.dev) - Schema validation
- [Zustand](https://docs.pmnd.rs/zustand) - State management
- [Motion](https://motion.dev) - Animations
- [t3-env](https://env.t3.gg) - Environment varia[](https://www.ultracite.ai/)bles
- [Pino](https://getpino.io) - Structured Logging
- [Langfuse](https://langfuse.com) - LLM observability & analytics
- [Vercel Analytics](https://vercel.com/analytics) - Web analytics
- [Biome](https://biomejs.dev) - Code linting and formatting
- [Ultracite](https://ultracite.ai) - Biome preset for humans and AI
- [Streamdown](https://streamdown.ai/) - Markdown for AI streaming
- [AI Elements](https://ai-sdk.dev/elements/overview) - AI-native Components
- [AI SDK Tools](https://ai-sdk-tools.dev/) - Developer tools for AI SDK

## Features

- 🤖 **120+ AI Models** - Claude, GPT-5, Gemini, Grok via Vercel AI Gateway
- 🔐 **Auth & Sync** - Secure authentication with cross-device chat history
- 🎯 **Try Without Signup** - Guest access for instant demos
- 📎 **Attachments** - Images, PDFs, documents in conversations
- 🎨 **Image Generation** - AI-powered image creation and editing
- 💻 **Syntax Highlighting** - Code formatting for all languages
- 🔄 **Resumable Streams** - Continue after interruptions
- 🌳 **Chat Branching** - Alternative conversation paths
- 🔗 **Chat Sharing** - Share conversations with others
- 🔭 **Deep Research** - Real-time web search with citations
- ⚡ **Code Execution** - Secure Python/JavaScript sandboxes
- 📄 **Document Creation** - Generate docs, spreadsheets, presentations

## Quick Start

1. **Clone and Install**

   ```bash
   git clone https://github.com/franciscomoretti/sparka.git
   cd sparka
   bun install
   ```

2. **Environment Setup**

   ```bash
   cp .env.example .env.local
   ```

   ### Vercel (recommended)

   - Use the Deploy button below. In the flow, add the Vercel Postgres and Vercel Blob integrations (or select existing resources).

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?demo-description=Production-ready%20AI%20chat&demo-image=https%3A%2F%2Fraw.githubusercontent.com%2FFranciscoMoretti%2Fsparka%2Frefs%2Fheads%2Fmain%2Fapp%2Fopengraph-image.png&demo-title=Sparka%20AI%20Chatbot&demo-url=https%3A%2F%2Fwww.sparka.ai%2F&env=AUTH_SECRET%2CAUTH_GITHUB_ID%2CAUTH_GITHUB_SECRET&envDescription=Set%20AUTH_SECRET%20with%20Generate%20Secret%20%28https%3A%2F%2Fgenerate-secret.vercel.app%2F32%29.%20Then%20set%20the%20GitHub%20auth%20provider%20pair%20%28https%3A%2F%2Fwww.better-auth.com%2Fdocs%2Fauthentication%2Fgithub%29.%20Optional%20variables%20can%20be%20set%20later%20to%20enable%20extra%20features.&envLink=https%3A%2F%2Fgithub.com%2Ffranciscomoretti%2Fsparka%2Fblob%2Fmain%2F.env.example&from=templates&products=%255B%257B%2522type%2522%253A%2522integration%2522%252C%2522protocol%2522%253A%2522storage%2522%252C%2522productSlug%2522%253A%2522neon%2522%252C%2522integrationSlug%2522%253A%2522neon%2522%257D%252C%257B%2522type%2522%253A%2522integration%2522%252C%2522protocol%2522%253A%2522storage%2522%252C%2522productSlug%2522%253A%2522upstash-kv%2522%252C%2522integrationSlug%2522%253A%2522upstash%2522%257D%252C%257B%2522type%2522%253A%2522blob%2522%257D%255D&project-name=Sparka%20AI&repository-name=sparka&repository-url=https%3A%2F%2Fgithub.com%2FFranciscoMoretti%2Fsparka&skippable-integrations=1)

   - After deploy (or locally after linking), pull envs:
     ```bash
     vercel link
     vercel env pull .env.local
     ```
   - Provided automatically on Vercel:
     - `VERCEL_OIDC_TOKEN` — replaces the need for `AI_GATEWAY_API_KEY`
     - `DATABASE_URL` — via Vercel Postgres integration
     - `BLOB_READ_WRITE_TOKEN` — via Vercel Blob integration
   - You still must set:
     - `AUTH_SECRET` — Better Auth secret
     - One auth provider (choose one pair):
       - `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`
       - `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`

   ### Self-hosted / other platforms

   - Set all required variables manually:

     - `DATABASE_URL`
     - `BLOB_READ_WRITE_TOKEN`
     - `AUTH_SECRET`
     - And either `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`

   - Set the auth provider variables
     - `AUTH_SECRET` — Better Auth secret
     - One auth provider (choose one pair):
       - `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`
       - `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`

   **Optional:**

   - `CRON_SECRET` — For the cleanup cron job
   - `REDIS_URL` - For resumable streams
   - `OPENAI_API_KEY` - Direct OpenAI access
   - `TAVILY_API_KEY` - Web search
   - `EXA_API_KEY` - Web search
   - `FIRECRAWL_API_KEY` - Web scraping
   - `SANDBOX_TEMPLATE_ID` - Code execution
   - `E2B_API_KEY` - E2B Code Interpreter
   - `LANGFUSE_PUBLIC_KEY` - Observability (Langfuse)
   - `LANGFUSE_SECRET_KEY` - Observability (Langfuse)
   - `LANGFUSE_BASE_URL` - Langfuse base URL (optional)
   - `VERCEL_URL` - Deployment URL
   - `VERCEL_PROJECT_PRODUCTION_URL` - Production URL override

3. **Database Setup**

   ```bash
   bun run db:migrate
   ```

4. **Development Server**
   ```bash
   bun dev
   ```

Visit [http://localhost:3000](http://localhost:3000) to start building.

## Deploy Your Own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?demo-description=Production-ready%20AI%20chat&demo-image=https%3A%2F%2Fraw.githubusercontent.com%2FFranciscoMoretti%2Fsparka%2Frefs%2Fheads%2Fmain%2Fapp%2Fopengraph-image.png&demo-title=Sparka%20AI%20Chatbot&demo-url=https%3A%2F%2Fwww.sparka.ai%2F&env=AUTH_SECRET%2CAUTH_GITHUB_ID%2CAUTH_GITHUB_SECRET&envDescription=Set%20AUTH_SECRET%20with%20Generate%20Secret%20%28https%3A%2F%2Fgenerate-secret.vercel.app%2F32%29.%20Then%20set%20the%20GitHub%20auth%20provider%20pair%20%28https%3A%2F%2Fwww.better-auth.com%2Fdocs%2Fauthentication%2Fgithub%29.%20Optional%20variables%20can%20be%20set%20later%20to%20enable%20extra%20features.&envLink=https%3A%2F%2Fgithub.com%2Ffranciscomoretti%2Fsparka%2Fblob%2Fmain%2F.env.example&from=templates&products=%255B%257B%2522type%2522%253A%2522integration%2522%252C%2522protocol%2522%253A%2522storage%2522%252C%2522productSlug%2522%253A%2522neon%2522%252C%2522integrationSlug%2522%253A%2522neon%2522%257D%252C%257B%2522type%2522%253A%2522integration%2522%252C%2522protocol%2522%253A%2522storage%2522%252C%2522productSlug%2522%253A%2522upstash-kv%2522%252C%2522integrationSlug%2522%253A%2522upstash%2522%257D%252C%257B%2522type%2522%253A%2522blob%2522%257D%255D&project-name=Sparka%20AI&repository-name=sparka&repository-url=https%3A%2F%2Fgithub.com%2FFranciscoMoretti%2Fsparka&skippable-integrations=1)


### Deploy Walkthrough
[![Youtube Video]()](https://www.youtube.com/watch?v=Gsvk1d7CqOk)
