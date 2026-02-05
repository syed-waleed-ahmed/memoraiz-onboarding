import "server-only";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  POSTGRES_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
  MEMORAIZ_MODEL: z.string().min(1).optional(),
});

const normalizedEnv = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => [
    key,
    typeof value === "string" && value.trim() === "" ? undefined : value,
  ]),
);

const parsed = EnvSchema.safeParse(normalizedEnv);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment variables: ${issues}`);
}

export const env = {
  ...parsed.data,
  NODE_ENV: parsed.data.NODE_ENV ?? "development",
};

export const hasLlmKey = Boolean(
  env.OPENAI_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY,
);

export function requireProductionEnv() {
  if (env.NODE_ENV !== "production") return;

  const missing: string[] = [];
  if (!env.POSTGRES_URL) missing.push("POSTGRES_URL");
  if (!hasLlmKey) {
    missing.push("OPENAI_API_KEY or GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY");
  }

  if (missing.length) {
    throw new Error(
      `Missing required env vars for production: ${missing.join(", ")}`,
    );
  }
}
