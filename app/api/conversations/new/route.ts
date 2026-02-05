import { NextResponse } from "next/server";
import { createConversation } from "@/lib/db/conversationRepo";

interface NewConversationBody {
  stableUserId?: string;
  tabSessionId?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as NewConversationBody;
  const stableUserId = body.stableUserId?.trim();

  if (!stableUserId) {
    return NextResponse.json({ error: "Missing stableUserId" }, { status: 400 });
  }

  const tabSessionId = body.tabSessionId?.trim() || crypto.randomUUID();
  const conversation = await createConversation(stableUserId, tabSessionId);

  if (!conversation) {
    return NextResponse.json({ error: "Conversation create failed" }, { status: 500 });
  }

  return NextResponse.json({
    conversation,
    tabSessionId,
  });
}
