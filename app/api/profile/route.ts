import { NextResponse } from "next/server";
import { getProfile, setProfile, type CompanyProfile } from "@/lib/store/profileStore";
import { getProfileById, upsertProfile } from "@/lib/db/profileRepo";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  if (process.env.POSTGRES_URL?.trim()) {
    const dbProfile = await getProfileById(sessionId);
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

  const profile = getProfile(sessionId);
  return NextResponse.json({ profile });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    sessionId?: string;
    profile?: CompanyProfile;
  };

  if (!body.sessionId || !body.profile) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  setProfile(body.sessionId, body.profile);

  if (process.env.POSTGRES_URL?.trim()) {
    await upsertProfile(body.sessionId, body.sessionId, body.profile).catch(
      () => null,
    );
  }

  return NextResponse.json({ ok: true });
}
