import { RequestContext } from "@mastra/core/request-context";
import { createOnboardingAgent, buildProfileContext } from "@/lib/mastra/agent";
import {
  getProfile,
  setProfile,
  type CompanyProfile,
} from "@/lib/store/profileStore";
import { appendMessage } from "@/lib/db/messageRepo";
import { getProfileById } from "@/lib/db/profileRepo";

function mapProfileFromDb(row: Record<string, unknown>): CompanyProfile {
  return {
    name: (row.name as string | null) ?? "",
    industry: (row.industry as string | null) ?? "",
    description: (row.description as string | null) ?? "",
    aiMaturityLevel: (row.ai_maturity_level as string | null) ?? "",
    aiUsage: (row.ai_usage as string | null) ?? "",
    goals: (row.goals as string | null) ?? "",
  };
}

export async function loadProfileForConversation(
  conversationId: string,
  fallbackProfile?: CompanyProfile,
) {
  if (fallbackProfile) {
    setProfile(conversationId, fallbackProfile);
    return fallbackProfile;
  }

  if (process.env.POSTGRES_URL?.trim()) {
    const dbProfile = await getProfileById(conversationId);
    if (dbProfile) {
      const profile = mapProfileFromDb(dbProfile as Record<string, unknown>);
      setProfile(conversationId, profile);
      return profile;
    }
  }

  return getProfile(conversationId);
}

interface ChatRunInput {
  message: string;
  conversationId: string;
  stableUserId: string;
  tabSessionId: string;
  profile?: CompanyProfile;
}

export async function runChat({
  message,
  conversationId,
  stableUserId,
  tabSessionId,
  profile,
}: ChatRunInput) {
  const currentProfile = await loadProfileForConversation(conversationId, profile);

  const requestContext = new RequestContext<{
    conversationId: string;
    stableUserId: string;
    tabSessionId: string;
    profile: CompanyProfile;
  }>();
  requestContext.set("conversationId", conversationId);
  requestContext.set("stableUserId", stableUserId);
  requestContext.set("tabSessionId", tabSessionId);
  requestContext.set("profile", currentProfile);

  const agent = createOnboardingAgent();
  await appendMessage(stableUserId, conversationId, "user", message).catch(
    () => null,
  );

  const output = await agent.generate(
    [
      {
        role: "system",
        content: buildProfileContext(currentProfile),
      },
      {
        role: "user",
        content: message,
      },
    ],
    { requestContext },
  );

  const updatedProfile = getProfile(conversationId);
  await appendMessage(stableUserId, conversationId, "assistant", output.text).catch(
    () => null,
  );

  return {
    reply: output.text,
    profile: updatedProfile,
  };
}

import { getAvailableModels } from "@/lib/mastra/agent";
import { getHeroAnswer } from "./heroAnswers";

export async function streamChat({
  message,
  conversationId,
  stableUserId,
  tabSessionId,
  profile,
}: ChatRunInput) {
  const currentProfile = await loadProfileForConversation(conversationId, profile);

  const requestContext = new RequestContext<{
    conversationId: string;
    stableUserId: string;
    tabSessionId: string;
    profile: CompanyProfile;
  }>();
  requestContext.set("conversationId", conversationId);
  requestContext.set("stableUserId", stableUserId);
  requestContext.set("tabSessionId", tabSessionId);
  requestContext.set("profile", currentProfile);

  // Save user message once
  await appendMessage(stableUserId, conversationId, "user", message).catch(
    () => null,
  );

  const messages = [
    {
      role: "system",
      content: buildProfileContext(currentProfile),
    },
    {
      role: "user",
      content: message,
    },
  ];

  // Get available models (e.g. OpenAI, Gemini)
  const models = getAvailableModels();

  // -- FAST PATH: Hero Answers --
  const heroAnswer = getHeroAnswer(message);
  if (heroAnswer) {
    console.log(`[Fast Path] Hero Answer found for: "${message}"`);
    const encoder = new TextEncoder();
    return new ReadableStream({
      async start(controller) {
        // Split by whitespace but keep the spaces in the output by using a regex with capture group
        const words = heroAnswer.split(/(\s+)/);

        for (const word of words) {
          if (word) {
            controller.enqueue(encoder.encode(word));
            // Simulate natural typing speed (~30ms per word/space)
            await new Promise((resolve) => setTimeout(resolve, 30));
          }
        }

        controller.close();
        // Persist the message
        await appendMessage(stableUserId, conversationId, "assistant", heroAnswer).catch(() => null);
      }
    });
  }

  // If no specific models found, use default (which handles fallback inside agent)
  if (models.length === 0) {
    models.push("");
  }

  // Create a promise for each model that resolves when the stream is ready
  const streamPromises = models.map(async (modelId) => {
    try {
      const agent = createOnboardingAgent(modelId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await agent.stream(messages as any, { requestContext });
      return { result, modelId };
    } catch (error) {
      console.error(`Error starting stream for model ${modelId}:`, error);
      // Return a never-resolving promise or just throw to be caught by race?
      // Better to return null and filter out
      return null;
    }
  });

  // Race to get the first successful stream start
  // We need to handle cases where one might fail
  const winningStream = await Promise.any(
    streamPromises.map(p => p.then(res => {
      if (!res) throw new Error("Stream failed to start");
      return res;
    }))
  );

  console.log(`[Race] Winner: ${winningStream.modelId}`);

  const textStream = winningStream.result.textStream;
  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of textStream) {
          const text = chunk;
          fullText += text;
          controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      } finally {
        if (fullText) {
          await appendMessage(stableUserId, conversationId, "assistant", fullText).catch(
            () => null,
          );
        }
      }
    },
  });

  return stream;
}
