# Memoraiz Onboarding Assistant

Split-screen onboarding experience with a live company profile canvas and a Mastra-powered interview agent.

## Highlights

- Per-tab chat sessions with persistent conversation history.
- Sidebar conversation hub with rename/delete flows.
- Real-time company canvas synced to the chat.
- Light/dark theme toggle with theme-aware styling.

## Requirements

- Node.js 20+
- pnpm 10+

## Setup

1. Copy environment variables: duplicate `.env.example` to `.env.local`, then fill the values listed in the next section.

1. Install dependencies: `pnpm install`.

1. Run the dev server: `pnpm dev`.

1. (Optional) Ingest docs into pgvector: `pnpm ingest:docs`.

1. Apply database schema (required for chat history + vector search): `pnpm tsx scripts/apply-schema.ts`.

1. Run tests: `pnpm test`.

## Environment variables

Set these in `.env.local` (values depend on your provider and deployment target):

- `POSTGRES_URL` (required for conversation history + canvas storage)
- `OPENAI_API_KEY` (OpenAI support)
- `GEMINI_API_KEY` (Gemini support)
- `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini fallback if needed)
- `MEMORAIZ_MODEL` (optional; example: `google/gemini-1.5-flash-latest`)

## Database setup

- Schema lives in `lib/db/schema.sql`.
- Apply locally with `pnpm tsx scripts/apply-schema.ts`.
- Uses `pgcrypto` for UUIDs and includes conversations, messages, profiles, and documents.

## Notes

- The onboarding chat API lives in `app/api/chat/route.ts` (agent proxy in `app/api/agent/route.ts`).
- The split-screen UI shell is in `app/page.tsx`.
- Profile endpoint is `app/api/profile/route.ts`.
- Postgres schema is in `lib/db/schema.sql`.
- Postgres helper is `scripts/apply-schema.ts` (loads `.env.local`).
- Local doc fallback uses markdown and PDF files in the project root (or the two included Memoraiz docs).
- CI runs lint, tests, and build via GitHub Actions. Vercel deploy uses repository secrets.

## Scripts

- `pnpm dev` - run the dev server.
- `pnpm build` - production build.
- `pnpm test` - test runner.
- `pnpm ingest:docs` - optional pgvector document ingestion.
