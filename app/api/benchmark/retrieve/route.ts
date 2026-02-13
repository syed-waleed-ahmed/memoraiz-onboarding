import { NextRequest, NextResponse } from "next/server";
import { embedText } from "@/lib/mastra/embeddings";
import { searchDocuments } from "@/lib/db/vectorRepo";
import { searchLocalDocs } from "@/lib/mastra/docs";

interface ResultItem {
    content: string;
    title?: string | null;
    source?: string | null;
    score?: number;
}

export async function POST(req: NextRequest) {
    try {
        const { query, limit = 5 } = await req.json();

        if (!query || typeof query !== "string") {
            return NextResponse.json({ error: "query (string) is required" }, { status: 400 });
        }

        let results: ResultItem[] = [];

        // Try vector search first (if Postgres is ready)
        try {
            if (process.env.POSTGRES_URL?.trim()) {
                const embedding = await embedText(query);
                results = await searchDocuments(embedding, Math.min(limit, 10));
            }
        } catch (e) {
            console.error("[benchmark/retrieve] Vector search failed, falling back to local:", e);
        }

        // Fallback to local documents (matches production agent behavior)
        if (results.length === 0) {
            results = await searchLocalDocs(query, Math.min(limit, 10));
        }

        return NextResponse.json({
            contexts: results.map((r) => r.content),
            metadata: results.map((r) => ({
                title: r.title,
                source: r.source,
                score: r.score,
            })),
        });
    } catch (error) {
        console.error("[benchmark/retrieve] error:", error);
        return NextResponse.json({ error: "Retrieval failed" }, { status: 500 });
    }
}
