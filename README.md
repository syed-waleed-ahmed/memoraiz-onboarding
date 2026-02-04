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

4. (Optional) Ingest docs into pgvector:
	- `pnpm ingest:docs`

5. Run tests:
	- `pnpm test`

## Notes

- The onboarding agent API lives in `app/api/agent/route.ts`.
- The live canvas is in `app/page.tsx`.
- Database schema is in `lib/db/schema.sql`.
- Local doc fallback uses markdown and PDF files in the project root (or the two included Memoraiz docs).
- CI runs lint, tests, and build via GitHub Actions. Vercel deploy uses repository secrets.
