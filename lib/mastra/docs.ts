import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const RAG_SOURCES = [
  "Catalogo_MemorAIz_v1.md",
  "Features_List_Assistente_AI.md",
  "Memoraiz_Onboarding_Goals.md",
  "Memoraiz_Key_Concepts.md",
];

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 140;

export interface DocChunk {
  content: string;
  source: string;
  title: string;
}

function splitMarkdownSections(text: string) {
  const lines = text.split("\n");
  const sections: { title: string; content: string }[] = [];
  const titleStack: string[] = [];
  let buffer: string[] = [];

  const pushSection = () => {
    const content = buffer.join("\n").trim();
    if (!content) return;
    const title = titleStack.join(" / ").trim() || "Overview";
    sections.push({ title, content });
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = /^(#{1,3})\s+(.*)$/.exec(line.trim());
    if (headingMatch) {
      pushSection();
      const level = headingMatch[1].length;
      const heading = headingMatch[2].trim();
      titleStack.splice(level - 1);
      titleStack[level - 1] = heading;
      continue;
    }
    buffer.push(line);
  }

  pushSection();
  return sections;
}

async function resolveDocFiles() {
  const entries = await readdir(process.cwd());
  const available = new Set(entries);
  const preferred = RAG_SOURCES.filter((file) => available.has(file));
  if (preferred.length > 0) return preferred;
  return entries.filter((file) => /\.(md|pdf)$/i.test(file));
}

// Global cache for document chunks to avoid re-parsing on every request
let cachedChunks: DocChunk[] | null = null;

export async function loadDocChunks() {
  if (cachedChunks) {
    return cachedChunks;
  }

  const chunks: DocChunk[] = [];

  const files = await resolveDocFiles();

  for (const file of files) {
    const filePath = join(process.cwd(), file);
    let normalized = "";

    try {
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
    } catch (error) {
      console.error(`Error reading/parsing file ${file}:`, error);
      continue;
    }

    if (!normalized) continue;

    const sections = /\.pdf$/i.test(file)
      ? [{ title: file, content: normalized }]
      : splitMarkdownSections(normalized);

    for (const section of sections) {
      let index = 0;
      while (index < section.content.length) {
        const slice = section.content.slice(index, index + CHUNK_SIZE);
        const content = `Section: ${section.title}\n\n${slice}`.trim();
        chunks.push({ content, source: file, title: section.title });
        index += CHUNK_SIZE - CHUNK_OVERLAP;
      }
    }
  }

  cachedChunks = chunks;
  return chunks;
}

// Global cache for search results to avoid re-scoring on identical queries
const queryResultCache = new Map<string, (DocChunk & { score: number })[]>();

export async function searchLocalDocs(query: string, limit: number) {
  const needle = query.toLowerCase().trim();

  // Check cache first
  const cached = queryResultCache.get(needle);
  if (cached) {
    console.log(`[RAG Cache] Hit for query: "${needle}"`);
    return cached.slice(0, limit);
  }

  const chunks = await loadDocChunks();
  const scored = chunks
    .map((chunk) => {
      const haystack = chunk.content.toLowerCase();
      const titleHaystack = chunk.title.toLowerCase();
      const score = haystack.includes(needle)
        ? needle.length
        : 0;
      const keywordHits = needle
        .split(/\s+/)
        .filter(Boolean)
        .reduce((total, token) => {
          const inContent = haystack.includes(token) ? 1 : 0;
          const inTitle = titleHaystack.includes(token) ? 2 : 0;
          return total + inContent + inTitle;
        }, 0);

      return {
        ...chunk,
        score: score + keywordHits,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const results = scored.map((item) => ({
    content: item.content,
    title: item.title,
    source: item.source,
    score: item.score,
  }));

  // Store in cache
  queryResultCache.set(needle, results);

  return results.slice(0, limit);
}
