import { RequestContext } from "@mastra/core/request-context";
import { createOnboardingAgent, buildProfileContext } from "@/lib/mastra/agent";
import {
  getProfile,
  setProfile,
  type CompanyProfile,
} from "@/lib/store/profileStore";
import { appendMessage } from "@/lib/db/messageRepo";
import { getProfileById } from "@/lib/db/profileRepo";
import { env } from "@/lib/env";

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

  if (env.POSTGRES_URL?.trim()) {
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
