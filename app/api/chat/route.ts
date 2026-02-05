import { NextResponse } from "next/server";
import { getConversationById } from "@/lib/db/conversationRepo";
import { runChat } from "@/lib/api/chatService";
import type { CompanyProfile } from "@/lib/store/profileStore";

interface ChatRequestBody {
  message: string;
  conversationId?: string;
  stableUserId?: string;
  tabSessionId?: string;
  profile?: CompanyProfile;
}

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequestBody;

  if (!body.message?.trim()) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const stableUserId = body.stableUserId?.trim();
  const tabSessionId = body.tabSessionId?.trim();
  const conversationId = body.conversationId?.trim();

  if (!stableUserId || !tabSessionId || !conversationId) {
    return NextResponse.json({ error: "Missing session identifiers" }, { status: 400 });
  }

  const conversation = await getConversationById(stableUserId, conversationId);
  if (!conversation || conversation.tabSessionId !== tabSessionId) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const output = await runChat({
    message: body.message,
    conversationId,
    stableUserId,
    tabSessionId,
    profile: body.profile,
  });

  return NextResponse.json({
    reply: output.reply,
    conversationId,
    profile: output.profile,
  });
}
