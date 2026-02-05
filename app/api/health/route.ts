import { NextResponse } from "next/server";
import { env, hasLlmKey } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = env.POSTGRES_URL && hasLlmKey ? "ok" : "degraded";

  return NextResponse.json({
    status,
    postgresConfigured: Boolean(env.POSTGRES_URL),
    llmConfigured: hasLlmKey,
    timestamp: new Date().toISOString(),
  });
}
