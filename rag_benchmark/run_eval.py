"""
RAG Benchmark: Evaluate OpenAI vs Gemini on your own Memoraiz data.

This script:
1. Loads questions from questions.json
2. Retrieves real context from your Postgres+pgvector database via /api/benchmark/retrieve
3. Generates answers using each model via /api/benchmark/generate
4. Evaluates with RAGAS (faithfulness, answer_relevancy, context_precision, context_recall)
5. Outputs a side-by-side comparison report
"""

import json
import os
import requests
import pandas as pd
import argparse
from ragas import evaluate, EvaluationDataset, SingleTurnSample
from ragas.metrics import Faithfulness, ResponseRelevancy, LLMContextPrecisionWithReference, LLMContextRecall
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

# ── Configuration ──────────────────────────────────────────────────────────────
def parse_args():
    parser = argparse.ArgumentParser(description="RAG Benchmark: OpenAI vs Gemini")
    parser.add_argument(
        "--url", 
        type=str, 
        default=os.environ.get("BENCHMARK_BASE_URL", "http://localhost:3000"),
        help="Base URL of the running Next.js app (default: http://localhost:3000)"
    )
    return parser.parse_args()

args = parse_args()
BASE_URL = args.url.rstrip("/")
RETRIEVE_URL = f"{BASE_URL}/api/benchmark/retrieve"
GENERATE_URL = f"{BASE_URL}/api/benchmark/generate"

MODELS = [
    "openai/gpt-4o-mini",
    "google/gemini-2.0-flash",
]

QUESTIONS_FILE = os.path.join(os.path.dirname(__file__), "questions.json")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "results")
RETRIEVE_TOP_K = 5


# ── Step 1: Load Questions ────────────────────────────────────────────────────
def load_questions(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ── Step 2: Retrieve Context ──────────────────────────────────────────────────
def retrieve_context(question: str) -> list[str]:
    """Call the local API to get real context from Postgres+pgvector."""
    try:
        resp = requests.post(
            RETRIEVE_URL,
            json={"query": question, "limit": RETRIEVE_TOP_K},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json().get("contexts", [])
    except Exception as e:
        print(f"  WARNING: Retrieval failed: {e}")
        return []


# ── Step 3: Generate Answer ───────────────────────────────────────────────────
def generate_answer(question: str, contexts: list[str], model: str) -> dict:
    """Call the local API to generate an answer with a specific model."""
    try:
        resp = requests.post(
            GENERATE_URL,
            json={"question": question, "contexts": contexts, "model": model},
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "answer": data.get("answer", ""),
            "latency_ms": data.get("latency_ms", 0),
        }
    except Exception as e:
        print(f"  WARNING: Generation failed with {model}: {e}")
        return {"answer": "", "latency_ms": 0}


# ── Step 4: Evaluate with RAGAS v0.4 ─────────────────────────────────────────
def evaluate_with_ragas(results: list[dict]):
    """Run RAGAS evaluation on a list of results using v0.4 API."""
    llm = LangchainLLMWrapper(ChatOpenAI(model="gpt-4o-mini"))
    emb = LangchainEmbeddingsWrapper(OpenAIEmbeddings(model="text-embedding-3-small"))

    samples = []
    for r in results:
        samples.append(SingleTurnSample(
            user_input=r["question"],
            response=r["answer"],
            retrieved_contexts=r["contexts"],
            reference=r["ground_truth"],
        ))

    dataset = EvaluationDataset(samples=samples)

    metrics = [
        Faithfulness(llm=llm),
        ResponseRelevancy(llm=llm, embeddings=emb),
        LLMContextPrecisionWithReference(llm=llm),
        LLMContextRecall(llm=llm),
    ]

    result = evaluate(dataset=dataset, metrics=metrics)
    return result.to_pandas()


# ── Step 5: Run Full Benchmark ────────────────────────────────────────────────
def run_benchmark():
    print("=" * 60)
    print("  RAG Benchmark: OpenAI vs Gemini on YOUR Memoraiz Data")
    print("=" * 60)

    questions = load_questions(QUESTIONS_FILE)
    print(f"\nLoaded {len(questions)} questions from questions.json\n")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    all_scores = {}

    for model in MODELS:
        model_label = model.replace("/", "_")
        print(f"\n{'='*50}")
        print(f"  Model: {model}")
        print(f"{'='*50}")

        results = []
        total_latency = 0

        for i, q in enumerate(questions):
            question = q["question"]
            ground_truth = q["ground_truth"]

            print(f"\n  [{i+1}/{len(questions)}] {question}")

            print("    -> Retrieving context from Postgres...")
            contexts = retrieve_context(question)
            print(f"    -> Got {len(contexts)} context chunks")

            print(f"    -> Generating answer with {model}...")
            gen = generate_answer(question, contexts, model)
            answer = gen["answer"]
            latency = gen["latency_ms"]
            total_latency += latency

            print(f"    -> Answer ({latency}ms): {answer[:80]}...")

            results.append({
                "question": question,
                "answer": answer,
                "contexts": contexts,
                "ground_truth": ground_truth,
                "latency_ms": latency,
            })

        # Save raw results
        results_path = os.path.join(OUTPUT_DIR, f"{model_label}_results.json")
        with open(results_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\n  Raw results saved to {results_path}")

        # Evaluate with RAGAS
        print(f"\n  Evaluating with RAGAS...")
        scores_df = evaluate_with_ragas(results)
        
        # Diagnostic: print columns to see what RAGAS actually returned
        print(f"  RAGAS returned columns: {list(scores_df.columns)}")

        def get_score(df, *possible_names):
            for name in possible_names:
                if name in df.columns:
                    return round(float(df[name].mean()), 4)
            print(f"  WARNING: Could not find any of {possible_names} in columns {list(df.columns)}")
            return 0.0

        avg_scores = {
            "faithfulness": get_score(scores_df, "faithfulness"),
            "answer_relevancy": get_score(scores_df, "answer_relevancy", "response_relevancy"),
            "context_precision": get_score(scores_df, "context_precision_with_reference", "llm_context_precision_with_reference", "context_precision"),
            "context_recall": get_score(scores_df, "context_recall", "llm_context_recall"),
            "avg_latency_ms": round(total_latency / len(questions)),
        }

        all_scores[model] = avg_scores
        print(f"  Scores: {avg_scores}")

        # Save per-model detailed scores
        scores_df.to_csv(os.path.join(OUTPUT_DIR, f"{model_label}_detailed.csv"), index=False)

    # ── Final Report ──────────────────────────────────────────────────────────
    print(f"\n\n{'=' * 60}")
    print("  FINAL COMPARISON REPORT")
    print(f"{'=' * 60}\n")

    rows = []
    for model, scores in all_scores.items():
        rows.append({
            "Model": model,
            "Faithfulness": scores["faithfulness"],
            "Response Relevancy": scores["answer_relevancy"],
            "Context Precision": scores["context_precision"],
            "Context Recall": scores["context_recall"],
            "Avg Latency (ms)": scores["avg_latency_ms"],
        })

    df = pd.DataFrame(rows)
    print(df.to_string(index=False))

    csv_path = os.path.join(OUTPUT_DIR, "comparison_report.csv")
    df.to_csv(csv_path, index=False)
    print(f"\n  Report saved to {csv_path}")

    json_path = os.path.join(OUTPUT_DIR, "comparison_report.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_scores, f, indent=2)
    print(f"  JSON saved to {json_path}")

    return all_scores


if __name__ == "__main__":
    run_benchmark()
