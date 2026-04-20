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

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
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
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].content = "Sorry, something went wrong.";
        return updated;
      });
    }

    setLoading(false);
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 rounded-full shadow-lg flex items-center justify-center text-2xl transition-all z-50"
        >
          💬
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-0 right-0 w-full sm:w-[420px] h-[70vh] sm:h-[600px] sm:bottom-6 sm:right-6 bg-zinc-900 sm:rounded-2xl shadow-2xl flex flex-col z-50 border border-zinc-700">
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-800">
            <div>
              <span className="font-medium text-sm">Ask about your data</span>
              <span className="ml-2 text-xs text-indigo-400">Claude</span>
            </div>
            <div className="flex gap-2">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1"
                >
                  Clear
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-200 text-lg leading-none">
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-2 mt-2">
                <p className="text-xs text-zinc-500">Try asking:</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full text-left text-xs text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg px-3 py-2 transition-colors"
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
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-zinc-800 text-zinc-100 rounded-bl-sm"
                  }`}
                >
                  {m.content || (loading && i === messages.length - 1 ? (
                    <span className="inline-flex gap-1">
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
          <div className="px-3 pb-3 pt-2 border-t border-zinc-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder="Ask about your health & mood..."
                disabled={loading}
                className="flex-1 bg-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || loading}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl text-sm transition-colors"
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
