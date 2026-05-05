"use client";

import { useState, useEffect } from "react";

const LABELS = ["None", "Minimal", "Minimal", "Mild", "Mild", "Moderate", "Moderate", "Significant", "Significant", "Severe", "Severe"];

function color(n: number) {
  if (n <= 2) return "var(--c-positive)";
  if (n <= 5) return "var(--c-caution)";
  return "var(--c-negative)";
}

export default function SymptomLog() {
  const [value, setValue] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    fetch("/api/health/symptoms")
      .then(r => r.json())
      .then(d => setValue(d.symptoms))
      .catch(() => {});
  }, []);

  async function log(n: number) {
    setValue(n);
    setStatus("saving");
    await fetch("/api/health/symptoms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symptoms: n }),
    });
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <section className="glass rounded-2xl p-4">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h2 className="font-semibold text-sm">AS symptoms · Today</h2>
          {value !== null && (
            <p className="text-xs mt-0.5" style={{ color: color(value) }}>
              {value}/10 — {LABELS[value]}
            </p>
          )}
        </div>
        {status === "saving" && <span className="text-xs" style={{ color: "var(--text-muted)" }}>Saving…</span>}
        {status === "saved" && <span className="text-xs" style={{ color: "var(--c-positive)" }}>✓ Saved</span>}
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            onClick={() => log(n)}
            className="flex-1 h-9 rounded-lg text-xs font-bold transition-all"
            style={{
              background: value === n ? color(n) : "var(--chip-bg)",
              color: value === n ? "#fff" : "var(--text-muted)",
              border: `1px solid ${value === n ? color(n) : "var(--chip-border)"}`,
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </section>
  );
}
