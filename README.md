## Memoraiz Onboarding Assistant

Split-screen onboarding experience with a live company profile canvas and a Mastra-powered interview agent.

## Requirements

- Node.js 20+
- pnpm 10+

## Setup

1. Copy environment variables:
	- Duplicate `.env.example` to `.env.local`
	- Add your `OPENAI_API_KEY` and `GEMINI_API_KEY`
	- If Gemini still errors, also set `GOOGLE_GENERATIVE_AI_API_KEY`
	- Default model is `openai/gpt-4o-mini`; set `MEMORAIZ_MODEL=google/gemini-1.5-flash-latest` to force Gemini
	- Add your `POSTGRES_URL` for pgvector

2. Install dependencies:
	- `pnpm install`

3. Run the dev server:
	- `pnpm dev`
	- Or run with Vercel locally: `vercel dev`

4. (Optional) Ingest docs into pgvector:
	- `pnpm ingest:docs`

5. Apply database schema (recommended before ingestion):
	- `pnpm tsx scripts/apply-schema.ts`

6. Run tests:
	- `pnpm test`

## Vercel Local Development

You can run the app locally using Vercel's dev server to match the production
runtime:

1. Install the Vercel CLI if you have not already:
	- `npm i -g vercel`
2. Ensure your `.env.local` contains `POSTGRES_URL` and at least one LLM key:
	- `OPENAI_API_KEY` or `GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`
3. Start the local Vercel dev server:
	- `vercel dev`

## Notes

- The onboarding agent API lives in `app/api/agent/route.ts`.
- The live canvas is in `app/page.tsx`.
- Profile polling endpoint is `app/api/profile/route.ts`.
- Database schema is in `lib/db/schema.sql`.
- Schema helper is `scripts/apply-schema.ts` (loads `.env.local`).
- Chat history is stored in the `chat_messages` table and loaded via `app/api/messages/route.ts`.
- Local doc fallback uses markdown and PDF files in the project root (or the two included Memoraiz docs).
- CI runs lint, tests, and build via GitHub Actions. Vercel deploy uses repository secrets.
