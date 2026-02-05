import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getPool } from "../lib/db/client";
import { embedText } from "../lib/mastra/embeddings";

import { config } from "dotenv";

config({ path: ".env.local" });
const RAG_SOURCES = [
  "Catalogo_MemorAIz_v1.md",
  "Features_List_Assistente_AI.md",
];

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 140;

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

async function ingest() {
  const pool = getPool();
  if (!pool) {
    throw new Error("POSTGRES_URL is required to ingest docs");
  }

  const files = await resolveDocFiles();

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

    const sections = /\.pdf$/i.test(file)
      ? [{ title: file, content: normalized }]
      : splitMarkdownSections(normalized);

    for (const section of sections) {
      let index = 0;
      while (index < section.content.length) {
        const slice = section.content.slice(index, index + CHUNK_SIZE);
        const content = `Section: ${section.title}\n\n${slice}`.trim();
        const embedding = await embedText(content);
        const vectorLiteral = `[${embedding.join(",")}]`;

        await pool.query(
          `insert into memoraiz_documents (id, source, title, content, embedding)
           values ($1, $2, $3, $4, $5)`,
          [randomUUID(), file, section.title, content, vectorLiteral],
        );

        index += CHUNK_SIZE - CHUNK_OVERLAP;
      }
    }
  }

  await pool.end();
}

ingest().catch((error) => {
  console.error(error);
  process.exit(1);
});
