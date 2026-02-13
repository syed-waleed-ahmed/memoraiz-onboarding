import { NextRequest, NextResponse } from "next/server";
import { createOnboardingAgent, buildProfileContext } from "@/lib/mastra/agent";
import { getProfile } from "@/lib/store/profileStore";

export async function POST(req: NextRequest) {
    try {
        const { question, contexts, model } = await req.json();

        if (!question || typeof question !== "string") {
            return NextResponse.json({ error: "question (string) is required" }, { status: 400 });
        }
        if (!model || typeof model !== "string") {
            return NextResponse.json({ error: "model (string) is required" }, { status: 400 });
        }

        const contextBlock = Array.isArray(contexts) && contexts.length > 0
            ? `\n\nRelevant context:\n${contexts.map((c: string, i: number) => `[${i + 1}] ${c}`).join("\n\n")}`
            : "";

        const dummyProfile = getProfile("benchmark");

        const agent = createOnboardingAgent(model);

        const startTime = Date.now();
        const output = await agent.generate([
            { role: "system", content: buildProfileContext(dummyProfile) + contextBlock },
            { role: "user", content: question },
        ]);
        const latencyMs = Date.now() - startTime;

        return NextResponse.json({
            answer: output.text,
            model,
            latency_ms: latencyMs,
        });
    } catch (error) {
        console.error("[benchmark/generate] error:", error);
        const message = error instanceof Error ? error.message : "Generation failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
