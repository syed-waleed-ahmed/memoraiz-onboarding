import { NextResponse } from "next/server";
import {
  deleteConversation,
  getConversationById,
  renameConversation,
} from "@/lib/db/conversationRepo";
import { listMessages } from "@/lib/db/messageRepo";
import { getProfileById } from "@/lib/db/profileRepo";
import {
  getProfile,
  setProfile,
  type CompanyProfile,
} from "@/lib/store/profileStore";
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const stableUserId = searchParams.get("stableUserId")?.trim();

  if (!stableUserId) {
    return NextResponse.json({ error: "Missing stableUserId" }, { status: 400 });
  }

  const conversation = await getConversationById(stableUserId, id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as {
    stableUserId?: string;
    tabSessionId?: string;
    title?: string;
  };
  const stableUserId = body.stableUserId?.trim();
  const title = body.title?.trim();

  if (!stableUserId || !title) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  await renameConversation(stableUserId, id, title);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const stableUserId = searchParams.get("stableUserId")?.trim();

  if (!stableUserId) {
    return NextResponse.json({ error: "Missing stableUserId" }, { status: 400 });
  }

  await deleteConversation(stableUserId, id);
  return NextResponse.json({ ok: true });
}
