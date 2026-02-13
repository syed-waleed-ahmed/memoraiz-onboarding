# RAG Benchmark: OpenAI vs Gemini on Your Own Data

Benchmark your **actual Memoraiz RAG pipeline** — real embeddings, real Postgres vectors, real agent — not a generic dataset.

## Prerequisites

- **Python 3.10+**
- **Next.js app running** (`npm run dev`)
- API keys in `.env.local` (`OPENAI_API_KEY` and `GEMINI_API_KEY`)

## Setup

```bash
pip install -r rag_benchmark/requirements.txt
```

## Run

```bash
# Make sure your app is running first!
npm run dev

# Then in another terminal:
python rag_benchmark/run_eval.py

# To benchmark against your production Vercel deployment:
python rag_benchmark/run_eval.py --url https://memoraiz-onboarding.vercel.app/
```

## What It Does

1. Loads **your questions** from `questions.json`
2. Calls your **real vector search** (Postgres + pgvector) for each question
3. Sends the retrieved context to **OpenAI GPT-4o-mini** and **Gemini 2.0 Flash**
4. Scores both models with **RAGAS** (Faithfulness, Answer Relevancy, Context Precision, Context Recall)
5. Outputs a **side-by-side comparison** (CSV + JSON)

## Customize

Edit `questions.json` to add your own questions and ground-truth answers. The more specific to your domain, the better the benchmark differentiates models.

## Output

Results are saved to `rag_benchmark/results/`:
- `comparison_report.csv` — Side-by-side table
- `comparison_report.json` — Raw scores + latency
- `*_results.json` — Per-model raw answers
