"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ChatRole = "assistant" | "user";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
}

interface CompanyProfile {
  name: string;
  industry: string;
  description: string;
  aiMaturityLevel: string;
  aiUsage: string;
  goals: string;
}

const INITIAL_PROFILE: CompanyProfile = {
  name: "",
  industry: "",
  description: "",
  aiMaturityLevel: "",
  aiUsage: "",
  goals: "",
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Hello! I’m the Memoraiz Onboarding Assistant. Let’s build your company profile. What’s your company name?",
    timestamp: "Now",
  },
];

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [profile, setProfile] = useState<CompanyProfile>(INITIAL_PROFILE);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [leftWidth, setLeftWidth] = useState(58);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const streamingTimerRef = useRef<number | null>(null);
  const pollingTimerRef = useRef<number | null>(null);

  const canEditForm = useMemo(() => !isTyping, [isTyping]);

  useEffect(() => {
    if (!isResizing) return;

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
  }, [isResizing]);

  useEffect(() => {
    if (!isTyping || !sessionId) {
      if (pollingTimerRef.current) {
        window.clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      return;
    }

    pollingTimerRef.current = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/profile?sessionId=${sessionId}`);
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
  }, [isTyping, sessionId]);

  const applyProfileUpdate = (field: keyof CompanyProfile, value: string) => {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: "Just now",
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId,
          profile,
        }),
      });

      if (!response.ok) {
        throw new Error("Agent request failed");
      }

      const data = (await response.json()) as {
        reply: string;
        sessionId: string;
        profile?: CompanyProfile;
      };

      if (data.sessionId) setSessionId(data.sessionId);
      if (data.profile) setProfile(data.profile);

      const replyId = crypto.randomUUID();
      setMessages((current) => [
        ...current,
        {
          id: replyId,
          role: "assistant",
          content: "",
          timestamp: "Now",
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
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "I ran into a problem reaching the onboarding agent. Please try again.",
          timestamp: "Now",
        },
      ]);
      setIsTyping(false);
    } finally {
      if (!streamingTimerRef.current) {
        setIsTyping(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E9D5FF] via-[#FBE8D0] to-[#EDE9FE] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <header className="flex items-center justify-between rounded-3xl border border-white/40 bg-white/35 px-6 py-4 shadow-lg backdrop-blur-xl">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-600">
              Memoraiz
            </p>
            <h1 className="text-2xl font-semibold">Corporate Onboarding</h1>
          </div>
          <div className="rounded-full border border-white/60 bg-white/50 px-4 py-2 text-xs font-semibold text-slate-700">
            Canvas Mode
          </div>
        </header>

        <div
          ref={containerRef}
          className="mt-6 grid flex-1 gap-0 overflow-hidden rounded-3xl border border-white/40 bg-white/30 shadow-2xl backdrop-blur-xl"
          style={{ gridTemplateColumns: `${leftWidth}% 10px ${100 - leftWidth}%` }}
        >
          <section className="flex h-full flex-col border-r border-white/40">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold">Onboarding Chat</h2>
                <p className="text-sm text-slate-600">
                  The assistant interviews your team and fills the canvas.
                </p>
              </div>
              <div className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600">
                {isTyping ? "Assistant typing…" : "Ready"}
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                      M
                    </div>
                  )}
                  <div
                    className={`max-w-[72%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      message.role === "user"
                        ? "bg-slate-900 text-white"
                        : "bg-white/80 text-slate-900"
                    }`}
                  >
                    <p className="leading-relaxed">{message.content}</p>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {message.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-white/40 bg-white/60 px-6 py-4">
              <div className="flex items-center gap-3">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  className="flex-1 rounded-full border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-slate-300"
                  placeholder="Share details about your company…"
                  disabled={isTyping}
                />
                <button
                  onClick={handleSend}
                  disabled={isTyping}
                  className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  Send
                </button>
              </div>
            </div>
          </section>

          <div
            className="cursor-col-resize bg-white/40"
            onPointerDown={() => setIsResizing(true)}
            role="presentation"
          />

          <aside className="flex h-full flex-col">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold">Company Canvas</h2>
                <p className="text-sm text-slate-600">
                  Structured profile updated by the agent in real time.
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  canEditForm
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {canEditForm ? "Editable" : "Locked"}
              </span>
            </div>

            <form className="flex-1 space-y-4 overflow-y-auto px-6 pb-6">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  Company Name
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none focus:border-slate-300"
                  value={profile.name}
                  onChange={(event) =>
                    applyProfileUpdate("name", event.target.value)
                  }
                  readOnly={!canEditForm}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  Industry
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none focus:border-slate-300"
                  value={profile.industry}
                  onChange={(event) =>
                    applyProfileUpdate("industry", event.target.value)
                  }
                  readOnly={!canEditForm}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  Description
                </label>
                <textarea
                  className="mt-2 min-h-[120px] w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none focus:border-slate-300"
                  value={profile.description}
                  onChange={(event) =>
                    applyProfileUpdate("description", event.target.value)
                  }
                  readOnly={!canEditForm}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  AI Maturity Level
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none focus:border-slate-300"
                  value={profile.aiMaturityLevel}
                  onChange={(event) =>
                    applyProfileUpdate("aiMaturityLevel", event.target.value)
                  }
                  readOnly={!canEditForm}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  Current AI Usage
                </label>
                <textarea
                  className="mt-2 min-h-[100px] w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none focus:border-slate-300"
                  value={profile.aiUsage}
                  onChange={(event) =>
                    applyProfileUpdate("aiUsage", event.target.value)
                  }
                  readOnly={!canEditForm}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  Goals
                </label>
                <textarea
                  className="mt-2 min-h-[100px] w-full rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm outline-none focus:border-slate-300"
                  value={profile.goals}
                  onChange={(event) =>
                    applyProfileUpdate("goals", event.target.value)
                  }
                  readOnly={!canEditForm}
                />
              </div>
            </form>
          </aside>
        </div>
      </div>
    </div>
  );
}
