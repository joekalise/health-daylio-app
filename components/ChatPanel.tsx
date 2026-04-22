"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "What's my average mood this month?",
  "Which activities correlate with my best moods?",
  "How has my HRV trended lately?",
  "What was my best sleep week recently?",
  "Compare my mood on days I exercise vs don't",
];

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const { text } = JSON.parse(data);
            if (text) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + text,
                };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].content = "Sorry, something went wrong.";
        return updated;
      });
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 220px)", minHeight: 400 }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-2 space-y-4 pr-1">
        {messages.length === 0 && (
          <div className="space-y-2 mt-2">
            <p className="text-xs text-zinc-500">Ask anything about your data:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full text-left text-xs text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/8 rounded-xl px-3 py-2.5 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                m.role === "user"
                  ? "bg-indigo-600/70 text-white rounded-br-sm"
                  : "bg-white/5 border border-white/8 text-zinc-100 rounded-bl-sm"
              }`}
            >
              {m.content || (loading && i === messages.length - 1 ? (
                <span className="inline-flex gap-1 py-0.5">
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              ) : "")}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-white/8 flex gap-2 mt-2">
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-xs text-zinc-600 hover:text-zinc-400 px-2 py-2 flex-shrink-0 transition-colors"
          >
            Clear
          </button>
        )}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Ask about your health & mood..."
          disabled={loading}
          className="flex-1 glass rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-50"
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          className="px-3 py-2 rounded-xl text-sm transition-all disabled:opacity-40 flex-shrink-0"
          style={{ background: "rgba(99,102,241,0.4)", border: "1px solid rgba(99,102,241,0.5)" }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
