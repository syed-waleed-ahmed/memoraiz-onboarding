import { Agent } from "@mastra/core/agent";
import { updateProfileTool, searchMemoraizDocsTool } from "./tools";
import type { CompanyProfile } from "../store/profileStore";

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = geminiKey;
  }
}

function resolveModel() {
  const envModel = process.env.MEMORAIZ_MODEL?.trim();
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());
  const fallbackModel = hasOpenAIKey
    ? "openai/gpt-4o-mini"
    : hasGeminiKey
      ? "google/gemini-1.5-flash-latest"
      : "openai/gpt-4o-mini";
  return envModel && envModel.length > 0 ? envModel : fallbackModel;
}

const SYSTEM_PROMPT = `You are the Memoraiz Onboarding Assistant.
Your job is to interview the user and build a structured company profile.
Ask one question at a time. Be concise and professional.
Always extract factual details from the user’s answers and call the updateProfile tool.
If the user asks about Memoraiz capabilities, call searchMemoraizDocs and answer using the returned snippets.
Never fabricate details about Memoraiz.
If you are missing information, ask a focused follow-up question.
Prioritize collecting: company name, industry, description, AI maturity level, current AI usage, and goals.
`;

export function createOnboardingAgent() {
  return new Agent({
    id: "memoraiz-onboarding-agent",
    name: "Memoraiz Onboarding Assistant",
    instructions: SYSTEM_PROMPT,
    model: resolveModel(),
    tools: {
      updateProfile: updateProfileTool,
      searchMemoraizDocs: searchMemoraizDocsTool,
    },
  });
}

export function buildProfileContext(profile: CompanyProfile) {
  return `Current company profile:\n- Name: ${profile.name || "(unknown)"}\n- Industry: ${profile.industry || "(unknown)"}\n- Description: ${profile.description || "(unknown)"}\n- AI maturity level: ${profile.aiMaturityLevel || "(unknown)"}\n- Current AI usage: ${profile.aiUsage || "(unknown)"}\n- Goals: ${profile.goals || "(unknown)"}`;
}
