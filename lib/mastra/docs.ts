import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const FALLBACK_DOCS = [
  "Catalogo_MemorAIz_v1.md",
  "Features_List_Assistente_AI.md",
];

export interface DocChunk {
  content: string;
  source: string;
}

export async function loadDocChunks() {
  const chunks: DocChunk[] = [];

  const entries = await readdir(process.cwd());
  const docFiles = entries.filter((file) =>
    /\.(md|pdf)$/i.test(file),
  );
  const files = docFiles.length > 0 ? docFiles : FALLBACK_DOCS;

  for (const file of files) {
    const filePath = join(process.cwd(), file);
    let normalized = "";

    if (/\.pdf$/i.test(file)) {
      const buffer = await readFile(filePath);
      const { default: pdfParse } = (await import("pdf-parse")) as {
        default: (data: Buffer | Uint8Array | ArrayBuffer) => Promise<{
          text: string;
        }>;
      };
      const parsed = await pdfParse(buffer);
      normalized = parsed.text.replace(/\r\n/g, "\n").trim();
    } else {
      const text = await readFile(filePath, "utf8");
      normalized = text.replace(/\r\n/g, "\n").trim();
    }

    if (!normalized) continue;

    const size = 800;
    const overlap = 120;
    let index = 0;

    while (index < normalized.length) {
      const slice = normalized.slice(index, index + size);
      chunks.push({ content: slice, source: file });
      index += size - overlap;
    }
  }

  return chunks;
}

export async function searchLocalDocs(query: string, limit: number) {
  const chunks = await loadDocChunks();
  const needle = query.toLowerCase();

  const scored = chunks
    .map((chunk) => {
      const haystack = chunk.content.toLowerCase();
      const score = haystack.includes(needle)
        ? needle.length
        : 0;
      const keywordHits = needle
        .split(/\s+/)
        .filter(Boolean)
        .reduce((total, token) => {
          return total + (haystack.includes(token) ? 1 : 0);
        }, 0);

      return {
        ...chunk,
        score: score + keywordHits,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((item) => ({
    content: item.content,
    source: item.source,
    score: item.score,
  }));
}
