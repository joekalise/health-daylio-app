"use client";

import { useState, useEffect } from "react";

const LABELS = ["None", "Minimal", "Mild", "Mild", "Moderate", "Moderate", "Significant", "High", "Severe", "Very severe", "Worst"];

function painColor(n: number) {
  if (n <= 2) return "var(--c-positive)";
  if (n <= 5) return "var(--c-caution)";
  return "var(--c-negative)";
}

function Scale({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-medium" style={{ color: "var(--text-dim)" }}>{label}</span>
        {value !== null && (
          <span className="text-xs font-semibold" style={{ color: painColor(value) }}>
            {value}/10 — {LABELS[value]}
          </span>
        )}
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className="flex-1 h-8 rounded-md text-xs font-bold transition-all"
            style={{
              background: value === n ? painColor(n) : "var(--chip-bg)",
              color: value === n ? "#fff" : "var(--text-muted)",
              border: `1px solid ${value === n ? painColor(n) : "var(--chip-border)"}`,
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PainLogCard() {
  const [pain, setPain] = useState<number | null>(null);
  const [stiffness, setStiffness] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    fetch("/api/health/pain")
      .then(r => r.json())
      .then(d => { setPain(d.pain); setStiffness(d.stiffness); })
      .catch(() => {});
  }, []);

  async function log(field: "pain" | "stiffness", value: number) {
    if (field === "pain") setPain(value);
    else setStiffness(value);
    setStatus("saving");
    await fetch("/api/health/pain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <section className="glass rounded-2xl p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-sm">Pain & Stiffness · Today</h2>
        {status === "saving" && <span className="text-xs" style={{ color: "var(--text-muted)" }}>Saving…</span>}
        {status === "saved" && <span className="text-xs" style={{ color: "var(--c-positive)" }}>✓ Saved</span>}
      </div>
      <Scale label="Pain level" value={pain} onChange={v => log("pain", v)} />
      <Scale label="Morning stiffness" value={stiffness} onChange={v => log("stiffness", v)} />
    </section>
  );
}
