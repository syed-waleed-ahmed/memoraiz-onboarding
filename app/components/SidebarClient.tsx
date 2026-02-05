"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getOrCreateStableUserId,
  getOrCreateTabSessionId,
  setTabSessionId,
} from "@/lib/session";

type ConversationMeta = {
  id: string;
  tabSessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
};

function bucketLabel(date: Date, now: Date) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - 6);

  if (date >= startOfToday) return "Today";
  if (date >= startOfYesterday) return "Yesterday";
  if (date >= startOfWeek) return "Last 7 days";
  return "Older";
}

function groupConversations(conversations: ConversationMeta[]) {
  const now = new Date();
  const buckets = new Map<string, ConversationMeta[]>();
  conversations.forEach((conversation) => {
    const timestamp = conversation.lastMessageAt ?? conversation.updatedAt;
    const label = bucketLabel(new Date(timestamp), now);
    const group = buckets.get(label) ?? [];
    group.push(conversation);
    buckets.set(label, group);
  });

  return ["Today", "Yesterday", "Last 7 days", "Older"]
    .map((label) => ({ label, items: buckets.get(label) ?? [] }))
    .filter((group) => group.items.length > 0);
}

export default function SidebarClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeConversationId = searchParams.get("c");
  const [stableUserId, setStableUserId] = useState<string | null>(null);
  const [tabSessionId, setTabSession] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);

  useEffect(() => {
    const stable = getOrCreateStableUserId();
    const tab = getOrCreateTabSessionId();
    setStableUserId(stable);
    setTabSession(tab);
  }, []);

  const groupedConversations = useMemo(
    () => groupConversations(conversations),
    [conversations],
  );

  async function refreshConversations(userId: string) {
    const response = await fetch(
      `/api/conversations?stableUserId=${userId}&tabSessionId=${tabSessionId ?? ""}`,
    );
    if (!response.ok) return;
    const data = (await response.json()) as { conversations: ConversationMeta[] };
    setConversations(data.conversations ?? []);
  }

  useEffect(() => {
    if (!stableUserId) return;
    void refreshConversations(stableUserId);

    const handleRefresh = () => {
      void refreshConversations(stableUserId);
    };
    window.addEventListener("memoraiz:conversations-updated", handleRefresh);
    return () => window.removeEventListener("memoraiz:conversations-updated", handleRefresh);
  }, [stableUserId]);

  async function handleNewConversation() {
    if (!stableUserId) return;
    const response = await fetch("/api/conversations/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stableUserId, tabSessionId: "" }),
    });
    if (!response.ok) return;
    const data = (await response.json()) as {
      conversation: ConversationMeta;
      tabSessionId: string;
    };
    setTabSessionId(data.tabSessionId);
    setTabSession(data.tabSessionId);
    router.replace(`/?c=${data.conversation.id}`);
    window.dispatchEvent(new CustomEvent("memoraiz:conversations-updated"));
  }

  async function handleDelete(conversationId: string) {
    if (!stableUserId) return;
    await fetch(
      `/api/conversations/${conversationId}?stableUserId=${stableUserId}&tabSessionId=${tabSessionId ?? ""}`,
      { method: "DELETE" },
    );
    window.dispatchEvent(new CustomEvent("memoraiz:conversations-updated"));
    if (activeConversationId === conversationId) {
      await handleNewConversation();
    }
  }

  async function handleDeleteActive() {
    if (!activeConversationId) return;
    await handleDelete(activeConversationId);
  }

  async function handleRename(conversationId: string) {
    if (!stableUserId) return;
    const nextTitle = window.prompt("Rename chat");
    if (!nextTitle?.trim()) return;
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stableUserId,
        tabSessionId,
        title: nextTitle.trim(),
      }),
    });
    window.dispatchEvent(new CustomEvent("memoraiz:conversations-updated"));
  }

  return (
    <div className="flex flex-1 flex-col px-6 pb-6 pt-5">
      <div className="flex items-center gap-2">
        <button
          onClick={handleNewConversation}
          className="flex-1 rounded-xl border border-emerald-400/30 bg-gradient-to-r from-emerald-400/15 via-transparent to-transparent px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-emerald-400/50"
        >
          + New chat
        </button>
        <button
          onClick={handleDeleteActive}
          disabled={!activeConversationId}
          className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:border-white/30 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Del
        </button>
      </div>

      <div className="mt-6 flex-1 space-y-6 overflow-y-auto text-sm">
        {groupedConversations.length === 0 ? (
          <p className="text-slate-500">No conversations yet. Start a new one.</p>
        ) : (
          groupedConversations.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                {group.label}
              </div>
              {group.items.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`group flex items-center justify-between rounded-xl px-3 py-2 transition hover:bg-white/5 ${
                    activeConversationId === conversation.id
                      ? "bg-white/10 text-white shadow-[0_16px_40px_-32px_rgba(56,189,248,0.6)]"
                      : "text-slate-300"
                  }`}
                >
                  <button
                    onClick={() => router.replace(`/?c=${conversation.id}`)}
                    className="flex-1 truncate text-left"
                  >
                    {conversation.title}
                  </button>
                  <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={() => handleRename(conversation.id)}
                      className="rounded px-1 text-xs text-slate-400 hover:text-slate-200"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(conversation.id)}
                      className="rounded px-1 text-xs text-rose-400 hover:text-rose-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
