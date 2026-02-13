"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import {
  getOrCreateStableUserId,
  getOrCreateTabSessionId,
  getStoredActiveConversationId,
  clearStoredActiveConversationId,
  setTabSessionId,
  setStoredActiveConversationId,
} from "@/lib/session";
import { prefetchConversation } from "@/lib/ui/conversationCache";

type ConversationMeta = {
  id: string;
  tabSessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
};

interface BucketLabeler {
  (date: Date, now: Date, t: (path: string) => string): string;
}

const bucketLabel: BucketLabeler = (date, now, t) => {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - 6);

  if (date >= startOfToday) return t("common.today");
  if (date >= startOfYesterday) return t("common.yesterday");
  if (date >= startOfWeek) return t("common.last_7_days");
  return t("common.older");
};

function groupConversations(conversations: ConversationMeta[], t: (path: string) => string) {
  const now = new Date();
  const buckets = new Map<string, ConversationMeta[]>();
  conversations.forEach((conversation) => {
    const timestamp = conversation.lastMessageAt ?? conversation.updatedAt;
    const label = bucketLabel(new Date(timestamp), now, t);
    const group = buckets.get(label) ?? [];
    group.push(conversation);
    buckets.set(label, group);
  });

  return [t("common.today"), t("common.yesterday"), t("common.last_7_days"), t("common.older")]
    .map((label) => ({ label, items: buckets.get(label) ?? [] }))
    .filter((group) => group.items.length > 0);
}

export default function SidebarClient() {
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const queryConversationId = searchParams.get("c");
  const [stableUserId, setStableUserId] = useState<string | null>(null);
  const [tabSessionId, setTabSession] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null,
  );
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(
    null,
  );
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    const stable = getOrCreateStableUserId();
    const tab = getOrCreateTabSessionId();
    setStableUserId(stable);
    setTabSession(tab);
  }, []);

  useEffect(() => {
    if (queryConversationId) {
      setActiveConversationId(queryConversationId);
      setStoredActiveConversationId(queryConversationId);
      return;
    }
    const stored = getStoredActiveConversationId();
    if (stored) {
      setActiveConversationId(stored);
    }
  }, [queryConversationId]);

  const groupedConversations = useMemo(
    () => groupConversations(conversations, t),
    [conversations, t],
  );

  const prefetchById = useCallback(
    async (conversation: ConversationMeta) => {
      if (!stableUserId) return;
      await prefetchConversation({
        conversationId: conversation.id,
        stableUserId,
        tabSessionId: conversation.tabSessionId,
      });
    },
    [stableUserId],
  );

  const refreshConversations = useCallback(
    async (userId: string) => {
      const response = await fetch(
        `/api/conversations?stableUserId=${userId}&tabSessionId=${tabSessionId ?? ""}`,
      );
      if (!response.ok) return;
      const data = (await response.json()) as { conversations: ConversationMeta[] };
      setConversations(data.conversations ?? []);
    },
    [tabSessionId],
  );

  useEffect(() => {
    if (!stableUserId) return;
    void refreshConversations(stableUserId);

    const handleRefresh = () => {
      const stored = getStoredActiveConversationId();
      if (stored) setActiveConversationId(stored);
      void refreshConversations(stableUserId);
    };
    window.addEventListener("memoraiz:conversations-updated", handleRefresh);
    return () => window.removeEventListener("memoraiz:conversations-updated", handleRefresh);
  }, [stableUserId, tabSessionId, refreshConversations]);

  useEffect(() => {
    if (!stableUserId || conversations.length === 0) return;
    const mostRecent = [...conversations]
      .sort((a, b) => {
        const left = new Date(a.lastMessageAt ?? a.updatedAt).getTime();
        const right = new Date(b.lastMessageAt ?? b.updatedAt).getTime();
        return right - left;
      })
      .slice(0, 3);

    const idle = (callback: () => void) => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(callback);
      } else {
        (window as Window).setTimeout(callback, 200);
      }
    };

    idle(() => {
      mostRecent.forEach((conversation) => {
        void prefetchById(conversation);
      });
    });
  }, [conversations, prefetchById, stableUserId]);

  function handleNewConversation() {
    // Client-side reset for instant "New Chat"
    const nextTabSessionId = crypto.randomUUID();
    setTabSessionId(nextTabSessionId);
    setTabSession(nextTabSessionId);

    clearStoredActiveConversationId();
    setActiveConversationId(null);

    // Clear URL params to reset ChatClient to empty state
    router.push("/");

    // Notify ChatClient to reset its state via custom event
    window.dispatchEvent(new CustomEvent("memoraiz:new-chat"));
  }

  function handleSelectConversation(conversation: ConversationMeta) {
    setActiveConversationId(conversation.id);
    setStoredActiveConversationId(conversation.id);
    router.replace(`/?c=${conversation.id}`);
  }

  async function handleDelete(conversationId: string, conversationTabSessionId?: string) {
    if (!stableUserId) return;
    const query = new URLSearchParams({ stableUserId });
    if (conversationTabSessionId) {
      query.set("tabSessionId", conversationTabSessionId);
    }
    const response = await fetch(
      `/api/conversations/${conversationId}?${query.toString()}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      if (response.status === 404) {
        window.dispatchEvent(new CustomEvent("memoraiz:conversations-updated"));
      }
      return;
    }
    if (activeConversationId === conversationId) {
      clearStoredActiveConversationId();
      setActiveConversationId(null);
      await handleNewConversation();
      return;
    }
    window.dispatchEvent(new CustomEvent("memoraiz:conversations-updated"));
  }

  async function handleRename(
    conversationId: string,
    conversationTabSessionId?: string,
  ) {
    if (!stableUserId) return;
    const nextTitle = editingTitle.trim();
    if (!nextTitle) return;
    const payload: {
      stableUserId: string;
      tabSessionId?: string | null;
      title: string;
    } = {
      stableUserId,
      title: nextTitle,
    };
    if (conversationTabSessionId) {
      payload.tabSessionId = conversationTabSessionId;
    }
    await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    window.dispatchEvent(new CustomEvent("memoraiz:conversations-updated"));
    setEditingConversationId(null);
  }

  function startEditing(conversation: ConversationMeta) {
    setEditingConversationId(conversation.id);
    setEditingTitle(conversation.title);
  }

  async function finishEditing(conversation: ConversationMeta) {
    if (!editingConversationId) return;
    if (editingTitle.trim() === conversation.title) {
      setEditingConversationId(null);
      return;
    }
    await handleRename(conversation.id, conversation.tabSessionId);
  }

  return (
    <div className="flex flex-1 flex-col px-6 pb-6 pt-5">
      <div className="flex items-center">
        <button
          onClick={handleNewConversation}
          className="theme-btn"
          style={{ width: '100%', borderRadius: '12px', fontSize: '15px', fontWeight: 600 }}
        >
          + {t("common.new_chat")}
        </button>
      </div>

      <div className="mt-6 flex-1 space-y-6 overflow-y-auto blend-scroll pr-1">
        {groupedConversations.length === 0 ? (
          <p className="text-slate-500">{t("common.no_conversations")}</p>
        ) : (
          groupedConversations.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="label-caps text-[11px] uppercase tracking-[0.2em] text-slate-500">
                {group.label}
              </div>
              {group.items.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`conversation-item group flex items-center justify-between rounded-xl px-3 py-2 transition ${activeConversationId === conversation.id
                    ? "conversation-item-active text-white"
                    : "text-slate-300"
                    }`}
                >
                  {editingConversationId === conversation.id ? (
                    <input
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onBlur={() => void finishEditing(conversation)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                        if (event.key === "Escape") {
                          setEditingConversationId(null);
                        }
                      }}
                      className="flex-1 rounded-md border border-white/10 bg-transparent px-2 py-1 text-left text-sm text-slate-100 outline-none focus:border-emerald-400/50"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => handleSelectConversation(conversation)}
                      onMouseEnter={() => void prefetchById(conversation)}
                      onFocus={() => void prefetchById(conversation)}
                      className="flex-1 truncate text-left"
                    >
                      {conversation.title}
                    </button>
                  )}
                  <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={() => startEditing(conversation)}
                      className="rounded p-1 text-slate-400 transition hover:text-slate-100"
                      aria-label="Rename"
                      title="Rename"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                    <button
                      onClick={() =>
                        handleDelete(conversation.id, conversation.tabSessionId)
                      }
                      className="rounded p-1 text-rose-400 transition hover:text-rose-300"
                      aria-label="Delete"
                      title="Delete"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M6 6l1 14h10l1-14" />
                        <path d="M10 10v6" />
                        <path d="M14 10v6" />
                      </svg>
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

