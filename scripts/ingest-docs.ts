import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getPool } from "../lib/db/client";
import { embedText } from "../lib/mastra/embeddings";

import { config } from "dotenv";

config({ path: ".env.local" });
const FALLBACK_DOCS = [
  "Catalogo_MemorAIz_v1.md",
  "Features_List_Assistente_AI.md",
];

async function ingest() {
  const pool = getPool();
  if (!pool) {
    throw new Error("POSTGRES_URL is required to ingest docs");
  }

  const entries = await readdir(process.cwd());
  const docFiles = entries.filter((file) => /\.(md|pdf)$/i.test(file));
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

    const size = 900;
    const overlap = 120;
    let index = 0;

    while (index < normalized.length) {
      const slice = normalized.slice(index, index + size);
      const embedding = await embedText(slice);
      const vectorLiteral = `[${embedding.join(",")}]`;

      await pool.query(
        `insert into memoraiz_documents (id, source, title, content, embedding)
         values ($1, $2, $3, $4, $5)`,
        [randomUUID(), file, file, slice, vectorLiteral],
      );

      index += size - overlap;
    }
  }

  await pool.end();
}

ingest().catch((error) => {
  console.error(error);
  process.exit(1);
});
