"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getOrCreateStableUserId,
  getOrCreateTabSessionId,
  setTabSessionId,
} from "@/lib/session";

type ChatRole = "assistant" | "user" | "system" | "tool";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
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
  const [isTyping, setIsTyping] = useState(false);
  const [leftWidth, setLeftWidth] = useState(58);
  const [isResizing, setIsResizing] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const streamingTimerRef = useRef<number | null>(null);
  const pollingTimerRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const stable = getOrCreateStableUserId();
    const tab = getOrCreateTabSessionId();
    setStableUserId(stable);
    setTabSession(tab);
  }, []);

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
        conversation: ConversationMeta;
        messages: ChatMessage[];
        profile: CompanyProfile;
      };
      setActiveConversationId(data.conversation.id);
      setMessages(data.messages ?? []);
      setProfile(data.profile ?? EMPTY_PROFILE);
      if (!queryConversationId || queryConversationId !== data.conversation.id) {
        router.replace(`/?c=${data.conversation.id}`);
      }
      window.dispatchEvent(new CustomEvent("memoraiz:conversations-updated"));
    }

    if (!queryConversationId) {
      void bootstrapConversation();
    }
  }, [stableUserId, tabSessionId, queryConversationId, router]);

  useEffect(() => {
    if (!queryConversationId || !stableUserId) return;

    async function loadConversation() {
      const response = await fetch(
        `/api/conversations/${queryConversationId}?stableUserId=${stableUserId}&tabSessionId=${tabSessionId ?? ""}`,
      );
      if (!response.ok) return;
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
    }

    void loadConversation();
  }, [queryConversationId, stableUserId, tabSessionId]);

  useEffect(() => {
    const shell = document.getElementById("chat-shell");
    if (!shell) return;
    shell.setAttribute("data-has-messages", messages.length > 0 ? "true" : "false");
  }, [messages.length]);

  useEffect(() => {
    if (!isResizing || isCompact) return;

    const handleMove = (event: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next = ((event.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(70, Math.max(35, next));
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

  const handleSend = async () => {
    if (!canSend || !activeConversationId || !stableUserId || !tabSessionId) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
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

      const characters = Array.from(data.reply);
      let index = 0;

      if (streamingTimerRef.current) {
        window.clearInterval(streamingTimerRef.current);
      }

      streamingTimerRef.current = window.setInterval(() => {
        index += 1;
        setMessages((current) =>
          current.map((message) =>
            message.id === replyId
              ? {
                  ...message,
                  content: characters.slice(0, index).join(""),
                }
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

  const gridColumns = isCompact ? "1fr" : `${leftWidth}% 12px ${100 - leftWidth}%`;

  return (
    <div
      ref={containerRef}
      className="app-shell grid h-auto flex-1 gap-0 overflow-hidden lg:h-full"
      style={{ gridTemplateColumns: gridColumns }}
    >
      <section className="panel flex h-auto flex-1 flex-col border-b border-white/10 min-h-[420px] lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-6 py-5">
          <div>
            <h2 className="heading-font text-lg font-semibold text-slate-100">
              Onboarding Chat
            </h2>
            <p className="text-sm text-slate-400">
              The assistant interviews your team and fills the canvas.
            </p>
          </div>
          <div className="badge-ready rounded-full px-3 py-1 text-xs font-medium">
            {isTyping ? "Assistant typing..." : "Ready"}
          </div>
        </div>

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-6 pb-6 blend-scroll">
          {messages.length === 0 && (
            <div className="panel-card p-6">
              <h3 className="heading-font text-2xl font-semibold text-slate-100">
                Hi there, where should we start?
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                Share a few details and I will update the canvas in real time.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {PROMPT_CHIPS.map((label) => (
                  <button
                    key={label}
                    onClick={() => setInput(label)}
                    className="chip rounded-full px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-white/30 hover:bg-white/5"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "message-user text-white"
                    : "message-assistant text-slate-200"
                }`}
              >
                <p>{message.content}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {formatTimestamp(message.createdAt)}
                </p>
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
        </div>

        <div className="border-t border-white/10 px-6 py-5">
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
              disabled={isTyping}
            />
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="primary-btn rounded-full px-4 py-2 text-xs font-semibold transition hover:brightness-105 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </section>

      <div
        onPointerDown={isCompact ? undefined : () => setIsResizing(true)}
        className="divider-rail hidden w-3 cursor-col-resize lg:block"
      />

      <section className="panel flex h-auto flex-1 flex-col px-6 py-6 min-h-[420px] lg:h-full lg:min-h-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="heading-font text-lg font-semibold text-slate-100">
              Company Canvas
            </h2>
            <p className="text-sm text-slate-400">
              Review or refine the profile as the agent learns.
            </p>
          </div>
          <div className="badge-editable rounded-full px-3 py-1 text-xs font-medium">
            {canEditForm ? "Editable" : "Locked"}
          </div>
        </div>

        <div className="mt-6 flex-1 min-h-0 space-y-4 overflow-y-auto pr-1 canvas-scroll">
          {(
            [
              { key: "name", label: "Company Name" },
              { key: "industry", label: "Industry" },
              { key: "description", label: "Description" },
              { key: "aiMaturityLevel", label: "AI Maturity" },
              { key: "aiUsage", label: "AI Usage" },
              { key: "goals", label: "Goals" },
            ] as const
          ).map(({ key, label }) => (
            <label key={key} className="block text-xs uppercase text-slate-500">
              {label}
              <textarea
                value={profile[key]}
                onChange={(event) => applyProfileUpdate(key, event.target.value)}
                className="mt-2 min-h-[78px] w-full rounded-2xl border border-white/10 bg-[#121722] px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-500 transition focus:border-white/30"
                placeholder={`Add ${label.toLowerCase()}...`}
                disabled={!canEditForm}
              />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
