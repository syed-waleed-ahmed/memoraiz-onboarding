import { NextResponse } from "next/server";
import { listMessages, appendMessage, type ChatRole } from "@/lib/db/messageRepo";
import { getConversationById } from "@/lib/db/conversationRepo";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId")?.trim();

  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  const messages = await listMessages(conversationId);
  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    conversationId?: string;
    stableUserId?: string;
    role?: ChatRole;
    content?: string;
  };

  const conversationId = body.conversationId?.trim();
  const stableUserId = body.stableUserId?.trim();
  const role = body.role;
  const content = body.content?.trim();

  if (!conversationId || !stableUserId || !role || !content) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const conversation = await getConversationById(stableUserId, conversationId);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const message = await appendMessage(stableUserId, conversationId, role, content);
  return NextResponse.json({ message });
}
