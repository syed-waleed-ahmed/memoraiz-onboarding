import { NextResponse } from "next/server";
import { listMessages } from "@/lib/db/messageRepo";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const messages = await listMessages(sessionId);
  return NextResponse.json({ messages });
}
