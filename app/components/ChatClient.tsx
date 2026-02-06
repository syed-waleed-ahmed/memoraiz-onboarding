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
import confetti from "canvas-confetti";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
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

  const canEditForm = useMemo(() => !isTyping && !isSubmitting, [isTyping, isSubmitting]);

  const isFormValid = useMemo(() => {
    return Object.values(profile).every((value) => value && value.trim().length > 0);
  }, [profile]);

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

  const handleRegenerate = async (assistantMessageId?: string) => {
    if (!activeConversationId || !stableUserId || !tabSessionId || isTyping) return;

    let targetUserMessage: ChatMessage | undefined;
    let keepMessages: ChatMessage[] = [];

    if (assistantMessageId) {
      // specific regeneration: find the assistant message, then the user message before it
      const assistantIndex = messages.findIndex(m => m.id === assistantMessageId);
      if (assistantIndex === -1) return;

      // Slicing: we want to keep messages *before* the assistant message. 
      // The user message should be the one immediately before ideally, or we find the last user message in that slice.
      const messagesBefore = messages.slice(0, assistantIndex);
      targetUserMessage = messagesBefore.findLast(m => m.role === "user");

      if (!targetUserMessage) return;

      const safeTarget = targetUserMessage;
      // We keep everything up to the user message (inclusive)
      const userIndex = messagesBefore.findIndex(m => m.id === safeTarget.id);
      keepMessages = messagesBefore.slice(0, userIndex + 1);

    } else {
      // default behavior: last user message
      targetUserMessage = messages.findLast(m => m.role === "user");
      if (!targetUserMessage) return;

      const safeTarget = targetUserMessage;
      const userIndex = messages.findIndex(m => m.id === safeTarget.id);
      keepMessages = messages.slice(0, userIndex + 1);
    }

    if (!targetUserMessage) return;

    // Prune UI immediately
    setMessages(keepMessages);
    void regenerateFromMessage(targetUserMessage.id, targetUserMessage.content);
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

        <div className="flex-1 min-h-0 overflow-y-auto blend-scroll no-scrollbar">
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
                className={`message-row flex ${message.role === "user" ? "justify-end" : "justify-start"
                  }`}
              >
                <div
                  className={`message-stack flex max-w-[90%] flex-col gap-2 lg:max-w-[85%] ${message.role === "user" ? "items-end" : "items-start"
                    }`}
                >
                  <div
                    className={`message-bubble group relative w-full rounded-2xl border px-4 py-3 text-sm leading-relaxed ${message.role === "user"
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
                      className={`message-actions-inline ${message.role === "user" ? "justify-end" : "justify-start"
                        }`}
                    >
                      {message.role === "user" ? (
                        <>
                          <button
                            onClick={() => startEditingMessage(message)}
                            className="theme-btn-icon h-8 w-8 p-1.5"
                            disabled={isTyping}
                            aria-label="Edit message"
                            title="Edit"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleCopy(message.id, message.content)}
                            className="theme-btn-icon h-8 w-8 p-1.5"
                            aria-label="Copy message"
                            title={copiedMessageId === message.id ? "Copied" : "Copy"}
                          >
                            {copiedMessageId === message.id ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleRegenerate(message.id)}
                            className="theme-btn-icon h-8 w-8 p-1.5"
                            disabled={isTyping}
                            aria-label="Regenerate response"
                            title="Regenerate"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 12a9 9 0 1 1-6.21-8.85" />
                              <path d="M21 3v6h-6" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleCopy(message.id, message.content)}
                            className="theme-btn-icon h-8 w-8 p-1.5"
                            aria-label="Copy message"
                            title={copiedMessageId === message.id ? "Copied" : "Copy"}
                          >
                            {copiedMessageId === message.id ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => toggleFeedback(message.id, "up")}
                            className={`theme-btn-icon h-8 w-8 p-1.5 ${feedbackById[message.id] === "up" ? "is-active text-emerald-400" : ""
                              }`}
                            aria-label="Like message"
                            title="Like"
                          >
                            {feedbackById[message.id] === "up" ? (
                              <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M7 10v12" />
                                <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M7 10v12" />
                                <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => toggleFeedback(message.id, "down")}
                            className={`theme-btn-icon h-8 w-8 p-1.5 ${feedbackById[message.id] === "down" ? "is-active text-rose-400" : ""
                              }`}
                            aria-label="Dislike message"
                            title="Dislike"
                          >
                            {feedbackById[message.id] === "down" ? (
                              <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 14V2" />
                                <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 14V2" />
                                <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
                              </svg>
                            )}
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

      <section className="panel flex h-auto flex-1 flex-col min-h-[420px] lg:h-full lg:min-h-0 border-l border-white/5">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
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
          className="mt-0 flex-1 min-h-0 space-y-2 overflow-y-auto pl-4 pr-6 canvas-scroll"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!activeConversationId || !stableUserId) return;
            setIsSubmitting(true);
            try {
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
              setShowSuccess(true);
              confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#34d399', '#38bdf8', '#ffffff']
              });
              setTimeout(() => setShowSuccess(false), 3000);
            } catch {
              // error handling could go here
            } finally {
              setIsSubmitting(false);
            }
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
          <div className="pt-2 flex flex-col items-end">
            <button
              type="submit"
              className="formal-canvas-submit disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canEditForm || !isFormValid || isSubmitting}
            >
              {showSuccess ? "Request Submitted" : isSubmitting ? "Saving..." : "Submit"}
            </button>
            {showSuccess && (
              <p className="mt-2 text-xs text-emerald-400">
                Profile saved successfully!
              </p>
            )}
          </div>
        </form>
      </section>
    </div >
  );
}
