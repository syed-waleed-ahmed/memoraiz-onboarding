import OpenAI from "openai";
import { env } from "@/lib/env";

export async function embedText(text: string) {
  if (!env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is required for embeddings");
  }

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0]?.embedding ?? [];
}
