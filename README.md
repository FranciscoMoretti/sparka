<div align="center">

<img src="apps/chat/app/icon.svg" alt="ChatJS" width="64" height="64">

# ChatJS

Stop rebuilding the same AI chat infrastructure. ChatJS gives you a production-ready foundation with authentication, 120+ models, streaming, and tools so you can focus on what makes your app unique.

[**Documentation**](https://chatjs.dev/docs) · [**Live Demo**](https://chatjs.dev)

![DemosOnly](https://github.com/user-attachments/assets/f12e89dd-c10c-4e06-9b1a-a9fbd809d234)

</div>

<br />

## CLI

Create a new ChatJS app:

```bash
npx @chat-js/cli@latest create my-app
```

The CLI walks you through gateway, features, and auth choices, generates `chat.config.ts`, and lists the env vars required by your selections.

## Features

- **120+ Models**: Claude, GPT, Gemini, Grok via one API
- **Auth**: GitHub, Google, anonymous. Ready to go.
- **Attachments**: Images, PDFs, docs. Drag and drop.
- **Resumable Streams**: Continue generation after page refresh
- **Branching**: Fork conversations, explore alternatives
- **Sharing**: Share conversations with public links
- **Web Search**: Real-time web search integration
- **Image Generation**: AI-powered image creation
- **Code Execution**: Run code snippets in sandbox
- **MCP**: Model Context Protocol support
- **Desktop App**: Package as a native macOS, Windows, or Linux app with Electron

## Stack

- [Next.js](https://nextjs.org) - App Router, React Server Components
- [TypeScript](https://www.typescriptlang.org) - Full type safety
- [AI SDK](https://ai-sdk.dev/) - The AI Toolkit for TypeScript
- [AI Gateway](https://vercel.com/ai-gateway) - Unified access to 120+ AI models
- [Better Auth](https://www.better-auth.com) - Authentication & authorization
- [Drizzle ORM](https://orm.drizzle.team) - Type-safe database queries
- [PostgreSQL](https://www.postgresql.org) - Primary database
- [Redis](https://redis.io) - Caching & resumable streams
- [Vercel Blob](https://vercel.com/storage/blob) - Blob storage
- [Shadcn/UI](https://ui.shadcn.com) - Beautiful, accessible components
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [tRPC](https://trpc.io) - End-to-end type-safe APIs
- [Zod](https://zod.dev) - Schema validation
- [Zustand](https://docs.pmnd.rs/zustand) - State management
- [Motion](https://motion.dev) - Animations
- [t3-env](https://env.t3.gg) - Environment variables
- [Pino](https://getpino.io) - Structured Logging
- [Langfuse](https://langfuse.com) - LLM observability & analytics
- [Vercel Analytics](https://vercel.com/analytics) - Web analytics
- [Biome](https://biomejs.dev) - Code linting and formatting
- [Ultracite](https://ultracite.ai) - Biome preset for humans and AI
- [Streamdown](https://streamdown.ai/) - Markdown for AI streaming
- [AI Elements](https://ai-sdk.dev/elements/overview) - AI-native Components
- [AI SDK Tools](https://ai-sdk-tools.dev/) - Developer tools for AI SDK

## Monorepo Layout

- `apps/chat`: Next.js chat app
- `apps/docs`: Mintlify docs
- `packages/cli`: interactive scaffold CLI

## Development

- `bun dev:chat`: run chat app
- `bun dev:docs`: run docs
- `bun lint`: run workspace lint
- `bun test:types`: run chat app typecheck

## Documentation

Visit [chatjs.dev/docs](https://chatjs.dev/docs) to view docs.

## License

Apache-2.0

<br />
<a href="https://vercel.com/oss">
  <img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge.svg" />
</a>
<br />
