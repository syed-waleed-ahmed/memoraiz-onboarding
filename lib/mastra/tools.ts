import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import {
  getProfile,
  setProfile,
  updateProfileField,
  type CompanyProfile,
} from "../store/profileStore";
import { upsertProfile } from "../db/profileRepo";
import { embedText } from "./embeddings";
import { searchDocuments } from "../db/vectorRepo";
import { searchLocalDocs } from "./docs";
import { env } from "@/lib/env";

const profileFieldSchema = z.enum([
  "name",
  "industry",
  "description",
  "aiMaturityLevel",
  "aiUsage",
  "goals",
]);

export const updateProfileTool = createTool({
  id: "updateProfile",
  description:
    "Update a single field on the company profile canvas. Use whenever the user provides new information.",
  inputSchema: z.object({
    field: profileFieldSchema,
    value: z.string().min(1),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    profile: z.object({
      name: z.string(),
      industry: z.string(),
      description: z.string(),
      aiMaturityLevel: z.string(),
      aiUsage: z.string(),
      goals: z.string(),
    }),
  }),
  requestContextSchema: z.object({
    conversationId: z.string(),
    stableUserId: z.string().optional(),
    profile: z
      .object({
        name: z.string(),
        industry: z.string(),
        description: z.string(),
        aiMaturityLevel: z.string(),
        aiUsage: z.string(),
        goals: z.string(),
      })
      .optional(),
  }),
  execute: async (input, context) => {
    const requestContext = context.requestContext;
    const conversationId = requestContext?.get("conversationId") as
      | string
      | undefined;
    const stableUserId = requestContext?.get("stableUserId") as
      | string
      | undefined;
    const currentProfile = requestContext?.get("profile") as
      | CompanyProfile
      | undefined;

    if (!conversationId) {
      return { ok: false, profile: getProfile("anonymous") };
    }

    if (currentProfile) {
      setProfile(conversationId, currentProfile);
    }

    const updated = updateProfileField(
      conversationId,
      input.field,
      input.value,
    );

    const userId = stableUserId ?? conversationId;
    await upsertProfile(conversationId, userId, updated).catch(() => null);

    return { ok: true, profile: updated };
  },
});

export const searchMemoraizDocsTool = createTool({
  id: "searchMemoraizDocs",
  description:
    "Search Memoraiz documentation and return relevant snippets for answering capability questions.",
  inputSchema: z.object({
    query: z.string().min(3),
    limit: z.number().int().min(1).max(8).optional(),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        content: z.string(),
        source: z.string().optional(),
        score: z.number().optional(),
      }),
    ),
  }),
  execute: async (input) => {
    const limit = input.limit ?? 5;

    if (env.POSTGRES_URL?.trim() && env.OPENAI_API_KEY?.trim()) {
      const embedding = await embedText(input.query);
      const results = await searchDocuments(embedding, limit);
      if (results.length > 0) {
        return { results };
      }
    }

    const results = await searchLocalDocs(input.query, limit);
    return { results };
  },
});
