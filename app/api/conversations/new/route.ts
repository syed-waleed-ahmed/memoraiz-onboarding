import { NextResponse } from "next/server";
import { createConversation } from "@/lib/db/conversationRepo";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    stableUserId?: string;
    tabSessionId?: string;
  };

  const stableUserId = body.stableUserId?.trim();
  const tabSessionId = body.tabSessionId?.trim() || crypto.randomUUID();

  if (!stableUserId) {
    return NextResponse.json({ error: "Missing stableUserId" }, { status: 400 });
  }

  const conversation = await createConversation(stableUserId, tabSessionId);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation create failed" }, { status: 500 });
  }

  return NextResponse.json({ conversation, tabSessionId });
}
