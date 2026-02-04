import { NextResponse } from "next/server";
import { getProfile } from "@/lib/store/profileStore";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const profile = getProfile(sessionId);
  return NextResponse.json({ profile });
}
