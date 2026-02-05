import { NextResponse } from "next/server";
import {
  createConversation,
  findConversationBySession,
} from "@/lib/db/conversationRepo";
import { listMessages } from "@/lib/db/messageRepo";
import { getProfileById } from "@/lib/db/profileRepo";
import {
  getProfile,
  setProfile,
  type CompanyProfile,
} from "@/lib/store/profileStore";
import { env } from "@/lib/env";

interface BootstrapRequestBody {
  stableUserId?: string;
  tabSessionId?: string;
}

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

export async function POST(request: Request) {
  const body = (await request.json()) as BootstrapRequestBody;
  const stableUserId = body.stableUserId?.trim();
  const tabSessionId = body.tabSessionId?.trim();

  if (!stableUserId || !tabSessionId) {
    return NextResponse.json({ error: "Missing session identifiers" }, { status: 400 });
  }

  let conversation = await findConversationBySession(stableUserId, tabSessionId);
  if (!conversation) {
    conversation = await createConversation(stableUserId, tabSessionId);
  }

  if (!conversation) {
    return NextResponse.json({ error: "Conversation create failed" }, { status: 500 });
  }

  const messages = await listMessages(conversation.id);

  let profile: CompanyProfile | null = null;
  if (env.POSTGRES_URL?.trim()) {
    const dbProfile = await getProfileById(conversation.id);
    if (dbProfile) {
      profile = mapProfileFromDb(dbProfile as Record<string, unknown>);
      setProfile(conversation.id, profile);
    }
  }

  if (!profile) {
    profile = getProfile(conversation.id);
  }

  return NextResponse.json({
    conversation,
    messages,
    profile,
  });
}
