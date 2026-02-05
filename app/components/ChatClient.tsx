"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getOrCreateStableUserId,
  getOrCreateTabSessionId,
  getStoredActiveConversationId,
  clearStoredActiveConversationId,
  setTabSessionId,
  setStoredActiveConversationId,
} from "@/lib/session";
import {
  getCachedConversation,
  setCachedConversation,
} from "@/lib/ui/conversationCache";

type ChatRole = "assistant" | "user" | "system" | "tool";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  edited?: boolean;
}

interface ConversationMeta {
  id: string;
  tabSessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
}

interface CompanyProfile {
  name: string;
  industry: string;
  description: string;
  aiMaturityLevel: string;
  aiUsage: string;
  goals: string;
}

const EMPTY_PROFILE: CompanyProfile = {
  name: "",
  industry: "",
  description: "",
  aiMaturityLevel: "",
  aiUsage: "",
  goals: "",
};

const PROMPT_CHIPS = [
  "Summarize our company in two sentences.",
  "We build SaaS tools for retail analytics.",
  "Our AI maturity is early experimentation.",
  "We want to reduce onboarding time by 50%.",
];

const WELCOME_MESSAGE =
  "Hi! I’m the Memoraiz Onboarding Assistant — let’s build your company profile. What’s your company name?";

function formatTimestamp(value?: string) {
  if (!value) return "Now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryConversationId = searchParams.get("c");
  const [stableUserId, setStableUserId] = useState<string | null>(null);
  const [tabSessionId, setTabSession] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profile, setProfile] = useState<CompanyProfile>(EMPTY_PROFILE);
  const [input, setInput] = useState("");
  const [queuedInput, setQueuedInput] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [leftWidth, setLeftWidth] = useState(52);
  const [isResizing, setIsResizing] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [feedbackById, setFeedbackById] = useState<Record<string, "up" | "down">>(
    {},
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const streamingTimerRef = useRef<number | null>(null);
  const pollingTimerRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stable = getOrCreateStableUserId();
    const tab = getOrCreateTabSessionId();
    setStableUserId(stable);
    setTabSession(tab);
  }, []);

  const loadConversationById = useCallback(
    async (conversationId: string, options?: { replaceUrl?: boolean }) => {
      if (!stableUserId) return false;
      const cached = getCachedConversation(conversationId);
      if (cached) {
        setActiveConversationId(cached.conversation.id ?? conversationId);
        setMessages(cached.messages ?? []);
        setProfile(cached.profile ?? EMPTY_PROFILE);
        if (cached.conversation.tabSessionId) {
          setTabSessionId(cached.conversation.tabSessionId);
          setTabSession(cached.conversation.tabSessionId);
        }
      }
      const response = await fetch(
        `/api/conversations/${conversationId}?stableUserId=${stableUserId}&tabSessionId=${tabSessionId ?? ""}`,
      );
      if (!response.ok) return false;
      const data = (await response.json()) as {
        conversation: ConversationMeta;
        messages: ChatMessage[];
        profile: CompanyProfile;
      };
      setActiveConversationId(data.conversation.id);
      setMessages(data.messages ?? []);
      setProfile(data.profile ?? EMPTY_PROFILE);
      setTabSessionId(data.conversation.tabSessionId);
      setTabSession(data.conversation.tabSessionId);
      setStoredActiveConversationId(data.conversation.id);
      setCachedConversation(data.conversation.id, {
        conversation: data.conversation,
        messages: data.messages ?? [],
        profile: data.profile ?? EMPTY_PROFILE,
        fetchedAt: Date.now(),
      });
      if (options?.replaceUrl) {
        router.replace("/");
      }
      window.dispatchEvent(new CustomEvent("memoraiz:conversations-updated"));
      return true;
    },
    [router, stableUserId, tabSessionId],
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const handleChange = () => setIsCompact(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!stableUserId || !tabSessionId) return;

    async function bootstrapConversation() {
      const response = await fetch("/api/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stableUserId, tabSessionId }),
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        conversation: ConversationMeta | null;
        messages: ChatMessage[];
        profile: CompanyProfile;
      };
      if (data.conversation) {
        setActiveConversationId(data.conversation.id);
        setMessages(data.messages ?? []);
        setProfile(data.profile ?? EMPTY_PROFILE);
        setStoredActiveConversationId(data.conversation.id);
        setCachedConversation(data.conversation.id, {
          conversation: data.conversation,
          messages: data.messages ?? [],
          profile: data.profile ?? EMPTY_PROFILE,
          fetchedAt: Date.now(),
        });
        window.dispatchEvent(new CustomEvent("memoraiz:conversations-updated"));
      } else {
        setActiveConversationId(null);
        setMessages([]);
        setProfile(data.profile ?? EMPTY_PROFILE);
      }
    }

    const storedConversationId = getStoredActiveConversationId();
    if (!queryConversationId && storedConversationId && !activeConversationId) {
      void (async () => {
        const loaded = await loadConversationById(storedConversationId);
        if (!loaded) {
          clearStoredActiveConversationId();
          await bootstrapConversation();
        }
      })();
      return;
    }

    if (!queryConversationId && !activeConversationId) {
      void bootstrapConversation();
    }
  }, [
    activeConversationId,
    loadConversationById,
    queryConversationId,
    stableUserId,
    tabSessionId,
  ]);

  useEffect(() => {
    if (!queryConversationId) return;
    void loadConversationById(queryConversationId, { replaceUrl: true });
  }, [loadConversationById, queryConversationId]);

  useEffect(() => {
    const shell = document.getElementById("chat-shell");
    if (!shell) return;
    shell.setAttribute("data-has-messages", messages.length > 0 ? "true" : "false");
  }, [messages.length]);

  useEffect(() => {
    if (!activeConversationId) return;
    setCachedConversation(activeConversationId, {
      conversation: {
        id: activeConversationId,
        tabSessionId,
      },
      messages,
      profile,
      fetchedAt: Date.now(),
    });
  }, [activeConversationId, messages, profile, tabSessionId]);

  useEffect(() => {
    if (!isResizing || isCompact) return;

    const handleMove = (event: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next = ((event.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(64, Math.max(38, next));
      setLeftWidth(clamped);
    };

    const handleUp = () => setIsResizing(false);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [isResizing, isCompact]);

  useEffect(() => {
    if (!isTyping || !activeConversationId) {
      if (pollingTimerRef.current) {
        window.clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      return;
    }

    pollingTimerRef.current = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/profile?conversationId=${activeConversationId}&stableUserId=${stableUserId}&tabSessionId=${tabSessionId ?? ""}`,
        );
        if (!response.ok) return;
        const data = (await response.json()) as { profile: CompanyProfile };
        if (data.profile) setProfile(data.profile);
      } catch {
        // ignore polling errors
      }
    }, 1200);

    return () => {
      if (pollingTimerRef.current) {
        window.clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [isTyping, activeConversationId, stableUserId, tabSessionId]);

  const canSend = useMemo(
    () =>
      Boolean(
        input.trim() && !isTyping && activeConversationId && stableUserId && tabSessionId,
      ),
    [input, isTyping, activeConversationId, stableUserId, tabSessionId],
  );

  const canEditForm = useMemo(() => !isTyping, [isTyping]);

  const stopStreaming = useCallback(() => {
    if (streamingTimerRef.current) {
      window.clearInterval(streamingTimerRef.current);
      streamingTimerRef.current = null;
    }
    setIsTyping(false);
  }, []);

  const welcomeMessage = useMemo<ChatMessage | null>(() => {
    if (!activeConversationId) return null;
    return {
      id: `welcome-${activeConversationId}`,
      role: "assistant",
      content: WELCOME_MESSAGE,
      createdAt: new Date().toISOString(),
    };
  }, [activeConversationId]);

  const visibleMessages = useMemo(() => {
    if (messages.length > 0) return messages;
    return welcomeMessage ? [welcomeMessage] : [];
  }, [messages, welcomeMessage]);

  const handleCopy = useCallback(async (messageId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedMessageId(null);
      }, 1400);
    } catch {
      // ignore clipboard errors
    }
  }, []);

  const startEditingMessage = useCallback((message: ChatMessage) => {
    if (isTyping) return;
    setEditingMessageId(message.id);
    setEditingDraft(message.content);
  }, [isTyping]);

  const cancelEditingMessage = useCallback(() => {
    setEditingMessageId(null);
    setEditingDraft("");
  }, []);

  const saveEditedMessage = useCallback(() => {
    if (!editingMessageId) return;
    const next = editingDraft.trim();
    if (!next) return;
    setMessages((current) =>
      current.map((message) =>
        message.id === editingMessageId
          ? { ...message, content: next, edited: true }
          : message,
      ),
    );
    cancelEditingMessage();
    if (stableUserId && tabSessionId && activeConversationId && !isTyping) {
      void regenerateFromMessage(editingMessageId, next);
    }
  }, [
    activeConversationId,
    cancelEditingMessage,
    editingDraft,
    editingMessageId,
    isTyping,
    stableUserId,
    tabSessionId,
  ]);

  const toggleFeedback = useCallback((messageId: string, value: "up" | "down") => {
    setFeedbackById((current) => {
      if (current[messageId] === value) {
        const { [messageId]: _, ...rest } = current;
        return rest;
      }
      return { ...current, [messageId]: value };
    });
  }, []);

  const startStreamingReply = useCallback((reply: string) => {
    const replyId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      {
        id: replyId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      },
    ]);

    const characters = Array.from(reply);
    let index = 0;

    if (streamingTimerRef.current) {
      window.clearInterval(streamingTimerRef.current);
    }

    streamingTimerRef.current = window.setInterval(() => {
      index += 1;
      setMessages((current) =>
        current.map((message) =>
          message.id === replyId
            ? { ...message, content: characters.slice(0, index).join("") }
            : message,
        ),
      );

      if (index >= characters.length) {
        if (streamingTimerRef.current) {
          window.clearInterval(streamingTimerRef.current);
          streamingTimerRef.current = null;
        }
        setIsTyping(false);
      }
    }, 18);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (!isTyping && queuedInput && activeConversationId && stableUserId && tabSessionId) {
      const next = queuedInput;
      setQueuedInput(null);
      setInput("");
      void handleSend(next);
    }
  }, [isTyping, queuedInput, activeConversationId, stableUserId, tabSessionId]);

  const applyProfileUpdate = (field: keyof CompanyProfile, value: string) => {
    const nextProfile = {
      ...profile,
      [field]: value,
    };
    setProfile(nextProfile);

    if (!activeConversationId || !stableUserId) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          stableUserId,
          tabSessionId,
          profile: nextProfile,
        }),
      }).catch(() => null);
    }, 500);
  };

  const handleSend = async (overrideInput?: string) => {
    const nextInput = (overrideInput ?? input).trim();
    if (!nextInput || !stableUserId || !tabSessionId) return;
    if (isTyping && !overrideInput) {
      setQueuedInput(nextInput);
      setInput("");
      return;
    }

    let conversationId = activeConversationId;
    if (!conversationId) {
      const response = await fetch("/api/conversations/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stableUserId, tabSessionId }),
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        conversation: ConversationMeta;
        tabSessionId: string;
      };
      conversationId = data.conversation.id;
      setTabSessionId(data.tabSessionId);
      setTabSession(data.tabSessionId);
      setActiveConversationId(data.conversation.id);
      setStoredActiveConversationId(data.conversation.id);
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: nextInput,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMessage]);
    if (!overrideInput) setInput("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId: conversationId,
          stableUserId,
          tabSessionId,
          profile,
        }),
      });

      if (!response.ok) {
        throw new Error("Chat request failed");
      }

      const data = (await response.json()) as {
        reply: string;
        conversationId: string;
        profile?: CompanyProfile;
      };

      if (data.profile) setProfile(data.profile);
      startStreamingReply(data.reply);

      if (conversationId) {
        setCachedConversation(conversationId, {
          conversation: { id: conversationId, tabSessionId },
          messages: [...messages, userMessage],
          profile,
          fetchedAt: Date.now(),
        });
      }
      window.dispatchEvent(new CustomEvent("memoraiz:conversations-updated"));
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "I ran into a problem reaching the agent. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
      setIsTyping(false);
    } finally {
      if (!streamingTimerRef.current) {
        setIsTyping(false);
      }
    }
  };

  const regenerateFromMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!activeConversationId || !stableUserId || !tabSessionId || isTyping) return;
      setIsTyping(true);
      setOpenMenuId(null);

      setMessages((current) => {
        const index = current.findIndex((message) => message.id === messageId);
        if (index < 0) return current;
        return current.slice(0, index + 1);
      });

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            conversationId: activeConversationId,
            stableUserId,
            tabSessionId,
            profile,
          }),
        });

        if (!response.ok) {
          throw new Error("Chat request failed");
        }

        const data = (await response.json()) as {
          reply: string;
          conversationId: string;
          profile?: CompanyProfile;
        };

        if (data.profile) setProfile(data.profile);
        startStreamingReply(data.reply);
        window.dispatchEvent(new CustomEvent("memoraiz:conversations-updated"));
      } catch {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "I ran into a problem regenerating the response. Please try again.",
            createdAt: new Date().toISOString(),
          },
        ]);
        setIsTyping(false);
      }
    },
    [activeConversationId, isTyping, profile, stableUserId, tabSessionId, startStreamingReply],
  );

  const handleRegenerate = async () => {
    if (!activeConversationId || !stableUserId || !tabSessionId || isTyping) return;
    const lastUserIndex = [...messages]
      .map((message, index) => ({ message, index }))
      .reverse()
      .find((item) => item.message.role === "user");
    if (!lastUserIndex) return;
    void regenerateFromMessage(lastUserIndex.message.id, lastUserIndex.message.content);
  };

  const gridColumns = isCompact ? "1fr" : `${leftWidth}% 12px ${100 - leftWidth}%`;

  return (
    <div
      ref={containerRef}
      data-resizing={isResizing ? "true" : "false"}
      className="app-shell grid h-auto flex-1 gap-0 overflow-hidden transition-[grid-template-columns] duration-150 lg:h-full"
      style={{ gridTemplateColumns: gridColumns }}
    >
      <section className="panel flex h-auto flex-1 flex-col border-b border-white/10 min-h-[420px] lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r">
        <div className="chat-column mx-auto w-full px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title heading-font text-lg font-semibold text-slate-100">
                Onboarding Chat
              </h2>
              <p className="section-subtitle text-sm text-slate-400">
                The assistant interviews your team and fills the canvas.
              </p>
            </div>
            <div className="badge-ready rounded-full px-3 py-1 text-xs font-medium">
              {isTyping ? "Assistant typing..." : "Ready"}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto blend-scroll">
          <div className="chat-column mx-auto w-full space-y-4 px-6 pb-6">
            {messages.length === 0 && (
              <div className="panel-card p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Quick prompts
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {PROMPT_CHIPS.map((label) => (
                    <button
                      key={label}
                      onClick={() => setInput(label)}
                      className="chip rounded-full px-4 py-2 text-xs font-medium text-slate-200"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {visibleMessages.map((message) => (
              <div
                key={message.id}
                className={`message-row flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`message-stack flex max-w-[70%] flex-col gap-2 lg:max-w-[65%] ${
                    message.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`message-bubble group relative w-full rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "message-user text-white"
                        : "message-assistant text-slate-200"
                    }`}
                  >
                    {editingMessageId === message.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingDraft}
                          onChange={(event) => setEditingDraft(event.target.value)}
                          className="message-editor w-full rounded-xl border border-white/10 bg-transparent px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400/50"
                          rows={3}
                        />
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            onClick={saveEditedMessage}
                            className="theme-btn-icon rounded-full px-3 py-1"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditingMessage}
                            className="theme-btn-icon rounded-full px-3 py-1 opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p>{message.content}</p>
                        <div className="message-meta mt-2 flex items-center gap-2 text-xs text-slate-500">
                          <span>{formatTimestamp(message.createdAt)}</span>
                          {message.edited && message.role === "user" && (
                            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                              Edited
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {message.role !== "system" && !message.id.startsWith("welcome-") && (
                    <div
                      className={`message-actions-inline ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {message.role === "user" ? (
                        <>
                          <button
                            onClick={() => startEditingMessage(message)}
                            className="theme-btn-icon"
                            disabled={isTyping}
                            aria-label="Edit message"
                            title="Edit"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleCopy(message.id, message.content)}
                            className="theme-btn-icon"
                            aria-label="Copy message"
                            title={copiedMessageId === message.id ? "Copied" : "Copy"}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <rect x="9" y="9" width="11" height="11" rx="2" />
                              <rect x="4" y="4" width="11" height="11" rx="2" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={handleRegenerate}
                            className="theme-btn-icon"
                            disabled={isTyping}
                            aria-label="Regenerate response"
                            title="Regenerate"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                              <path d="M21 3v6h-6" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleCopy(message.id, message.content)}
                            className="theme-btn-icon"
                            aria-label="Copy message"
                            title={copiedMessageId === message.id ? "Copied" : "Copy"}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <rect x="9" y="9" width="11" height="11" rx="2" />
                              <rect x="4" y="4" width="11" height="11" rx="2" />
                            </svg>
                          </button>
                          <button
                            onClick={() => toggleFeedback(message.id, "up")}
                            className={`theme-btn-icon ${
                              feedbackById[message.id] === "up" ? "is-active" : ""
                            }`}
                            aria-label="Like message"
                            title="Like"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h9a3 3 0 0 0 3-3v-6a2 2 0 0 0-2-2z" />
                              <path d="M7 22H4a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1h3" />
                            </svg>
                          </button>
                          <button
                            onClick={() => toggleFeedback(message.id, "down")}
                            className={`theme-btn-icon ${
                              feedbackById[message.id] === "down" ? "is-active" : ""
                            }`}
                            aria-label="Dislike message"
                            title="Dislike"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H8a3 3 0 0 0-3 3v6a2 2 0 0 0 2 2z" />
                              <path d="M17 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-3" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="panel-soft px-4 py-3 text-sm text-slate-400">
                  Typing...
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="chat-column mx-auto w-full px-6 py-5">
            <div className="input-shell flex items-center gap-3 rounded-full px-4 py-3">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Share details about your company..."
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
              />
              <button
                onClick={isTyping ? stopStreaming : () => void handleSend()}
                disabled={isTyping ? false : !canSend}
                className="theme-btn-icon flex h-9 w-9 items-center justify-center transition disabled:opacity-40"
                aria-label={isTyping ? "Stop generating" : "Send message"}
              >
                {isTyping ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none">
                    <path
                      d="M12 5l7 7-7 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M5 12h13"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div
        onPointerDown={isCompact ? undefined : () => setIsResizing(true)}
        className="divider-rail hidden cursor-col-resize lg:block"
      />

      <section className="panel flex h-auto flex-1 flex-col px-6 py-6 min-h-[420px] lg:h-full lg:min-h-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title heading-font text-lg font-semibold text-slate-100">
              Company Canvas
            </h2>
            <p className="section-subtitle text-sm text-slate-400">
              Review or refine the profile as the agent learns.
            </p>
          </div>
          <div className="badge-editable rounded-full px-3 py-1 text-xs font-medium">
            {canEditForm ? "Editable" : "Locked"}
          </div>
        </div>

        <form
          className="mt-6 flex-1 min-h-0 space-y-3 overflow-y-auto pr-1 canvas-scroll"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!activeConversationId || !stableUserId) return;
            await fetch("/api/profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                conversationId: activeConversationId,
                stableUserId,
                tabSessionId,
                profile,
              }),
            });
            // Optionally show a toast or confirmation here
          }}
        >
          {([
            { key: "name", label: "Company Name" },
            { key: "industry", label: "Industry" },
            { key: "description", label: "Description" },
            { key: "aiMaturityLevel", label: "AI Maturity" },
            { key: "aiUsage", label: "AI Usage" },
            { key: "goals", label: "Goals" },
          ] as const).map(({ key, label }) => (
            <label
              key={key}
              className="label-caps block text-[13px] font-medium tracking-wide text-slate-600 mb-1 formal-canvas-label"
              style={{ fontFamily: 'Segoe UI, Arial, Helvetica, sans-serif' }}
            >
              {label}
              <textarea
                value={profile[key]}
                onChange={(event) => applyProfileUpdate(key, event.target.value)}
                className="formal-canvas-textarea mt-1 w-full"
                placeholder={`Add ${label.toLowerCase()}...`}
                disabled={!canEditForm}
                style={{ fontFamily: 'Segoe UI, Arial, Helvetica, sans-serif', fontSize: '15px', lineHeight: '1.5' }}
              />
            </label>
          ))}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="formal-canvas-submit"
              disabled={!canEditForm}
            >
              Submit
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
