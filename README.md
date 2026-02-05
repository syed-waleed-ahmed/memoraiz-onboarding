# Memoraiz Onboarding Assistant

Split-screen onboarding experience with a live company profile canvas and a Mastra-powered interview agent.

## Requirements

- Node.js 20+
- pnpm 10+

## Setup

1. Copy environment variables: duplicate `.env.example` to `.env.local`, add your `OPENAI_API_KEY` and `GEMINI_API_KEY`, set `GOOGLE_GENERATIVE_AI_API_KEY` if Gemini still errors, optionally set `MEMORAIZ_MODEL=google/gemini-1.5-flash-latest`, and add your `POSTGRES_URL` for chat history + pgvector.

1. Install dependencies: `pnpm install`.

1. Run the dev server: `pnpm dev`.

1. (Optional) Ingest docs into pgvector: `pnpm ingest:docs`.

1. Apply database schema (required for chat history + vector search): `pnpm tsx scripts/apply-schema.ts`.

1. Run tests: `pnpm test`.

## Notes

- The onboarding agent API lives in `app/api/chat/route.ts` (legacy: `app/api/agent/route.ts`).
- The live canvas is in `app/page.tsx`.
- Profile endpoint is `app/api/profile/route.ts`.
- Postgres schema is in `lib/db/schema.sql`.
- Postgres helper is `scripts/apply-schema.ts` (loads `.env.local`).
- Local doc fallback uses markdown and PDF files in the project root (or the two included Memoraiz docs).
- CI runs lint, tests, and build via GitHub Actions. Vercel deploy uses repository secrets.
