import { NextResponse } from "next/server";
import { listConversations } from "@/lib/db/conversationRepo";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stableUserId = searchParams.get("stableUserId")?.trim();

  if (!stableUserId) {
    return NextResponse.json({ error: "Missing stableUserId" }, { status: 400 });
  }

  const conversations = await listConversations(stableUserId);
  return NextResponse.json({ conversations });
}
