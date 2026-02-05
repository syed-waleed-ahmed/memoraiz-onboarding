import { NextResponse } from "next/server";
import {
  getProfile,
  setProfile,
  type CompanyProfile,
} from "@/lib/store/profileStore";
import { getProfileById, upsertProfile } from "@/lib/db/profileRepo";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");

  if (!conversationId) {
    return NextResponse.json(
      { error: "Missing conversationId" },
      { status: 400 },
    );
  }

  if (env.POSTGRES_URL?.trim()) {
    const dbProfile = await getProfileById(conversationId);
    if (dbProfile) {
      const profile = {
        name: dbProfile.name ?? "",
        industry: dbProfile.industry ?? "",
        description: dbProfile.description ?? "",
        aiMaturityLevel: dbProfile.ai_maturity_level ?? "",
        aiUsage: dbProfile.ai_usage ?? "",
        goals: dbProfile.goals ?? "",
      } satisfies CompanyProfile;
      return NextResponse.json({ profile });
    }
  }

  const profile = getProfile(conversationId);
  return NextResponse.json({ profile });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    conversationId?: string;
    stableUserId?: string;
    tabSessionId?: string;
    profile?: CompanyProfile;
  };

  if (!body.conversationId || !body.profile) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  setProfile(body.conversationId, body.profile);

  if (env.POSTGRES_URL?.trim()) {
    const userId = body.stableUserId ?? body.conversationId;
    await upsertProfile(body.conversationId, userId, body.profile).catch(
      () => null,
    );
  }

  return NextResponse.json({ ok: true });
}
