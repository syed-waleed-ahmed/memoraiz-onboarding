import { NextResponse } from "next/server";
import { RequestContext } from "@mastra/core/request-context";
import { createOnboardingAgent, buildProfileContext } from "@/lib/mastra/agent";
import {
  getProfile,
  setProfile,
  type CompanyProfile,
} from "@/lib/store/profileStore";

interface AgentRequestBody {
  message: string;
  sessionId?: string | null;
  profile?: CompanyProfile;
}

export async function POST(request: Request) {
  const body = (await request.json()) as AgentRequestBody;

  if (!body.message?.trim()) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const sessionId = body.sessionId ?? crypto.randomUUID();
  const profile = body.profile ?? getProfile(sessionId);
  setProfile(sessionId, profile);

  const requestContext = new RequestContext<{
    sessionId: string;
    profile: CompanyProfile;
  }>();
  requestContext.set("sessionId", sessionId);
  requestContext.set("profile", profile);

  const agent = createOnboardingAgent();
  const output = await agent.generate(
    [
      {
        role: "system",
        content: buildProfileContext(profile),
      },
      {
        role: "user",
        content: body.message,
      },
    ],
    {
      requestContext,
    },
  );

  const updatedProfile = getProfile(sessionId);

  return NextResponse.json({
    reply: output.text,
    sessionId,
    profile: updatedProfile,
  });
}
