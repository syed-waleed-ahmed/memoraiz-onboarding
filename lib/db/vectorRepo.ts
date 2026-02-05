import { getPool } from "./client";

export interface VectorSearchResult {
  content: string;
  title?: string | null;
  source?: string | null;
  score?: number;
}

export async function searchDocuments(
  queryEmbedding: number[],
  limit: number,
): Promise<VectorSearchResult[]> {
  const pool = getPool();
  if (!pool) return [];

  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const result = await pool.query(
    `select content, title, source, 1 - (embedding <=> $1) as score
     from memoraiz_documents
     order by embedding <=> $1
     limit $2`,
    [vectorLiteral, limit],
  );

  return result.rows.map((row) => ({
    content: row.content as string,
    title: row.title as string | null,
    source: row.source as string | null,
    score: row.score as number,
  }));
}
