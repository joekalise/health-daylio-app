"use client";

import { useState } from "react";
import { MOOD_COLORS, MOOD_EMOJI } from "@/lib/mood";

const MOODS = ["rad", "good", "meh", "bad", "awful"] as const;

const ACTIVITY_GROUPS = [
  {
    label: "😴 Sleep",
    items: ["good sleep", "medium sleep", "bad sleep", "sleep early", "sleep late"],
  },
  {
    label: "🍽️ Food",
    items: ["homemade", "eat healthy", "restaurant", "delivery", "fast food", "no sweets", "no meat"],
  },
  {
    label: "👥 Social",
    items: ["family", "friends", "date", "party", "sex"],
  },
  {
    label: "💪 Fitness",
    items: ["exercise", "step goal"],
  },
  {
    label: "💼 Work",
    items: ["work", "coworking"],
  },
  {
    label: "🧘 Health",
    items: ["drink water", "sick", "anxiety attack"],
  },
  {
    label: "🚫 Avoiding",
    items: ["no alcohol", "no drugs", "no soda"],
  },
];

export default function MoodLogger({ onSaved }: { onSaved: () => void }) {
  const [mood, setMood] = useState<string>("");
  const [activities, setActivities] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (a: string) =>
    setActivities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);

  const save = async () => {
    if (!mood) return;
    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    await fetch("/api/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, mood, activities, note }),
    });
    setSaved(true);
    setTimeout(() => {
      setMood("");
      setActivities([]);
      setNote("");
      setSaving(false);
      setSaved(false);
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

  return (
    <div className="space-y-5 text-center">
      {/* Mood selector */}
      <div className="flex gap-2 justify-center">
        {MOODS.map((m) => (
          <button
            key={m}
            onClick={() => setMood(m)}
            className={`flex-1 py-5 rounded-2xl flex flex-col items-center gap-2 transition-all duration-150 ${
              mood === m ? "ring-2 ring-white/30 scale-105" : "opacity-50 hover:opacity-80"
            }`}
            style={{ backgroundColor: MOOD_COLORS[m] + (mood === m ? "33" : "1a") }}
          >
            <span className="text-4xl">{MOOD_EMOJI[m]}</span>
            <span className="text-xs font-medium" style={{ color: "var(--text-dim)" }}>{m}</span>
          </button>
        ))}
      </div>

      {/* Activities */}
      <div className="space-y-4">
        {ACTIVITY_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-sm font-medium mb-2 text-center" style={{ color: "var(--text-dim)" }}>{group.label}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {group.items.map((a) => (
                <button
                  key={a}
                  onClick={() => toggle(a)}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-all"
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
      </div>

      {/* Note */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything to note? (optional)"
        rows={2}
        className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none transition-colors"
        style={{
          background: "var(--input-bg)",
          border: "1px solid var(--chip-border)",
          color: "var(--text)",
        }}
      />

      <button
        onClick={save}
        disabled={!mood || saving}
        className="w-full py-3 rounded-2xl font-medium text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          backgroundColor: mood ? MOOD_COLORS[mood] : "#4f46e5",
          opacity: (!mood || saving) ? 0.3 : 1,
          color: "#fff",
        }}
      >
        {saving ? "Saving..." : mood ? `Log ${MOOD_EMOJI[mood]} ${mood}` : "Pick a mood to log"}
      </button>
    </div>
  );
}
