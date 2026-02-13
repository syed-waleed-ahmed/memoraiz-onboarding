# Memoraiz Onboarding Assistant

Split-screen onboarding experience with a live company-profile canvas and an AI-powered interview agent.

## Features

- **Conversational onboarding** — AI assistant interviews users and auto-fills the company canvas.
- **Per-tab sessions** — each browser tab gets its own chat, with persistent conversation history.
- **Sidebar conversation hub** — rename, delete, and switch between past conversations.
- **Light / dark theme** — toggle with theme-aware styling throughout.
- **Real-time canvas sync** — profile fields update as the chat progresses.
- **Mobile-ready** — tab switcher for seamless chat/canvas toggling on smaller screens.
- **Performance Optimized Stack**:
    - **Parallel LLM Race**: Launches OpenAI and Gemini simultaneously; the fastest response wins.
    - **Hybrid Caching**: Instant "Hero Answers" for common onboarding questions.
    - **In-Memory RAG Caching**: Drastically reduces latency for knowledge retrieval.
    - **Full Streaming**: Token-by-token delivery for zero perceived lag.
- **Smooth, polished UI** — micro-animations, blended scrollbars, and responsive layout.

## Requirements

- Node.js 20+
- npm 10+ (or pnpm / yarn)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
#    Copy .env.example to .env.local and fill in the required values (see below).

# 3. Apply the database schema (requires POSTGRES_URL)
npx tsx scripts/apply-schema.ts

# 4. Run the dev server
npm run dev

# 5. (Optional) Ingest docs into pgvector for RAG
npm run ingest:docs
```

## Environment Variables

Set these in `.env.local`:

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_URL` | Yes | Postgres connection string (conversations, profiles, vectors) |
| `OPENAI_API_KEY` | Yes* | OpenAI API key |
| `GEMINI_API_KEY` | Alt | Google Gemini API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Alt | Gemini fallback key |
| `MEMORAIZ_MODEL` | No | Override model, e.g. `google/gemini-1.5-flash-latest` |

*At least one AI provider key is required.

## Project Structure

```
app/
├── api/              # Next.js API routes
│   ├── agent/        # Agent proxy endpoint
│   ├── bootstrap/    # Session bootstrapping
│   ├── chat/         # Chat streaming endpoint
│   ├── conversations/# CRUD for conversations
│   ├── health/       # Health check
│   ├── messages/     # Message operations
│   └── profile/      # Company profile endpoint
├── components/       # React components
│   ├── ChatClient.tsx      # Main chat interface
│   ├── ChatShell.tsx       # Suspense wrapper
│   ├── MemoraizLogo.tsx    # Logo component
│   ├── Sidebar.tsx         # Sidebar layout
│   ├── SidebarClient.tsx   # Sidebar logic (conversations, new chat)
│   └── ThemeToggle.tsx     # Theme switcher
├── globals.css       # Design system & theme tokens
├── layout.tsx        # Root layout
└── page.tsx          # Home page

lib/
├── db/               # Database helpers (conversationRepo, messageRepo, etc.)
├── session.ts        # Client-side session management
├── store/            # In-memory profile store
└── ui/               # UI utilities (conversation cache)

scripts/
├── apply-schema.ts   # Apply Postgres schema
└── ingest-docs.ts    # Ingest documents for RAG
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests (Vitest) |
| `npm run ingest:docs` | Ingest documents into pgvector |

## RAG Benchmark

Evaluate and compare OpenAI and Gemini models against your actual project data.

- **Automated Metrics**: Faithfulness, Relevancy, Precision, and Recall using **RAGAS**.
- **Real-time Context**: Benchmarks against your live Postgres database or local Markdown documents.
- **Production Testing**: Supports benchmarking your local server or live Vercel deployment.

For detailed setup and execution instructions, see [rag_benchmark/README.md](rag_benchmark/README.md).

```bash
# Run benchmark locally
python rag_benchmark/run_eval.py

# Run against production
python rag_benchmark/run_eval.py --url https://memoraiz-onboarding.vercel.app/
```

## Database

Schema lives in `lib/db/schema.sql`. Apply it with:

```bash
npx tsx scripts/apply-schema.ts
```

Uses `pgcrypto` for UUIDs. Tables: `conversations`, `messages`, `profiles`, `documents`.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS 4 + custom design tokens
- **AI**: OpenAI / Google Gemini via Mastra
- **Database**: PostgreSQL + pgvector
- **Testing**: Vitest + Testing Library
- **Deployment**: Vercel
