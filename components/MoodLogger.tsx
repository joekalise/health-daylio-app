"use client";

import { useState, useEffect } from "react";
import { MOOD_COLORS, MOOD_EMOJI } from "@/lib/mood";

const MOODS = ["rad", "good", "meh", "bad", "awful"] as const;

const ACTIVITY_GROUPS = [
  { label: "😴 Sleep", items: ["good sleep", "medium sleep", "bad sleep", "sleep early", "sleep late"] },
  { label: "🍽️ Food", items: ["homemade", "eat healthy", "restaurant", "delivery", "fast food", "no sweets", "no meat"] },
  { label: "👥 Social", items: ["family", "friends", "date", "party", "sex"] },
  { label: "💪 Fitness", items: ["exercise", "step goal"] },
  { label: "💼 Work", items: ["work", "coworking"] },
  { label: "🧘 Health", items: ["drink water", "sick", "anxiety attack"] },
  { label: "🚫 Avoiding", items: ["no alcohol", "no drugs", "no soda"] },
];

const SYMPTOM_LABELS = ["None", "Minimal", "Minimal", "Mild", "Mild", "Moderate", "Moderate", "Significant", "Significant", "Severe", "Severe"];

function symptomColor(n: number) {
  if (n <= 2) return "var(--c-positive)";
  if (n <= 5) return "var(--c-caution)";
  return "var(--c-negative)";
}

export default function MoodLogger({ onSaved }: { onSaved: () => void }) {
  const [mood, setMood] = useState<string>("");
  const [activities, setActivities] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [step, setStep] = useState<"mood" | "details">("mood");
  const [symptom, setSymptom] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/health/symptoms")
      .then(r => r.json())
      .then(d => { if (d.symptoms != null) setSymptom(d.symptoms); })
      .catch(() => {});
  }, []);

  const toggle = (a: string) =>
    setActivities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);

  const pickMood = (m: string) => { setMood(m); setStep("details"); };

  const logSymptom = async (n: number) => {
    setSymptom(n);
    fetch("/api/health/symptoms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symptoms: n }),
    }).catch(() => {});
  };

  const save = async () => {
    if (!mood) return;
    setSaving(true);
    await fetch("/api/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: logDate, mood, activities, note }),
    });
    setSaved(true);
    setTimeout(() => {
      setMood(""); setActivities([]); setNote("");
      setSaving(false); setSaved(false); setStep("mood");
      onSaved();
    }, 800);
  };

  if (saved) {
    return (
      <div className="py-8 text-center space-y-2">
        <div className="text-5xl">{MOOD_EMOJI[mood]}</div>
        <p className="font-medium" style={{ color: "var(--text-dim)" }}>Logged!</p>
      </div>
    );
  }

  if (step === "mood") {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-center gap-2">
          <label className="text-xs font-medium" style={{ color: "var(--text-dim)" }}>Logging for</label>
          <input
            type="date"
            value={logDate}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => setLogDate(e.target.value)}
            className="text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
            style={{ background: "var(--input-bg)", border: "1px solid var(--chip-border)", color: "var(--text)" }}
          />
        </div>
        <p className="text-center text-sm font-medium" style={{ color: "var(--text-dim)" }}>How are you feeling?</p>
        <div className="flex gap-2 justify-center">
          {MOODS.map((m) => (
            <button
              key={m}
              onClick={() => pickMood(m)}
              className="flex-1 py-5 rounded-2xl flex flex-col items-center gap-2 transition-all duration-150 hover:scale-105 active:scale-95"
              style={{ backgroundColor: MOOD_COLORS[m] + "22", border: `1px solid ${MOOD_COLORS[m]}33` }}
            >
              <span className="text-4xl">{MOOD_EMOJI[m]}</span>
              <span className="text-xs font-medium" style={{ color: "var(--text-dim)" }}>{m}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Selected mood header */}
      <button
        onClick={() => setStep("mood")}
        className="w-full flex items-center gap-3 p-3 rounded-2xl transition-all"
        style={{ background: MOOD_COLORS[mood] + "1a", border: `1px solid ${MOOD_COLORS[mood]}33` }}
      >
        <span className="text-3xl">{MOOD_EMOJI[mood]}</span>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold capitalize" style={{ color: MOOD_COLORS[mood] }}>{mood}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Tap to change</p>
        </div>
        <input
          type="date"
          value={logDate}
          max={new Date().toISOString().split("T")[0]}
          onChange={(e) => { e.stopPropagation(); setLogDate(e.target.value); }}
          onClick={(e) => e.stopPropagation()}
          className="text-xs rounded-lg px-2 py-1 focus:outline-none"
          style={{ background: "var(--input-bg)", border: "1px solid var(--chip-border)", color: "var(--text)" }}
        />
      </button>

      {/* Activities */}
      <div className="space-y-4">
        {ACTIVITY_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-sm font-semibold mb-2 text-center" style={{ color: "var(--text-dim)" }}>{group.label}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {group.items.map((a) => (
                <button
                  key={a}
                  onClick={() => toggle(a)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                  style={activities.includes(a)
                    ? { background: "var(--c-primary)", color: "#fff" }
                    : { background: "var(--chip-bg)", border: "1px solid var(--chip-border)", color: "var(--text-dim)" }
                  }
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* AS Symptoms */}
        <div>
          <p className="text-sm font-semibold mb-2 text-center" style={{ color: "var(--text-dim)" }}>🩺 Symptoms</p>
          <div className="flex gap-1">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                onClick={() => logSymptom(n)}
                className="flex-1 h-8 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: symptom === n ? symptomColor(n) : "var(--chip-bg)",
                  color: symptom === n ? "#fff" : "var(--text-muted)",
                  border: `1px solid ${symptom === n ? symptomColor(n) : "var(--chip-border)"}`,
                }}
              >
                {n}
              </button>
            ))}
          </div>
          {symptom !== null && (
            <p className="text-xs text-center mt-1.5 font-medium" style={{ color: symptomColor(symptom) }}>
              {symptom}/10 — {SYMPTOM_LABELS[symptom]}
            </p>
          )}
        </div>
      </div>

      {/* Note */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything to note? (optional)"
        rows={2}
        className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none"
        style={{ background: "var(--input-bg)", border: "1px solid var(--chip-border)", color: "var(--text)" }}
      />

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-2xl font-semibold text-sm transition-all disabled:opacity-50"
        style={{ backgroundColor: MOOD_COLORS[mood], color: "#fff" }}
      >
        {saving ? "Saving..." : `Save ${MOOD_EMOJI[mood]} ${mood}`}
      </button>
    </div>
  );
}
