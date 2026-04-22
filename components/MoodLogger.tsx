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
        <p className="text-zinc-300 font-medium">Logged!</p>
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
              mood === m
                ? "ring-2 ring-white/30 scale-105"
                : "opacity-50 hover:opacity-80"
            }`}
            style={{
              backgroundColor: MOOD_COLORS[m] + (mood === m ? "33" : "1a"),
            }}
          >
            <span className="text-4xl">{MOOD_EMOJI[m]}</span>
            <span className="text-xs text-zinc-300 font-medium">{m}</span>
          </button>
        ))}
      </div>

      {/* Activities */}
      <div className="space-y-4 text-left">
        {ACTIVITY_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-sm font-medium text-zinc-300 mb-2">{group.label}</p>
            <div className="flex flex-wrap gap-2">
              {group.items.map((a) => (
                <button
                  key={a}
                  onClick={() => toggle(a)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activities.includes(a)
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                  }`}
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
        className="w-full bg-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 border border-zinc-700/50 focus:outline-none focus:border-indigo-500/50 resize-none transition-colors"
      />

      <button
        onClick={save}
        disabled={!mood || saving}
        className="w-full py-3 rounded-2xl font-medium text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          backgroundColor: mood ? MOOD_COLORS[mood] : "#4f46e5",
          opacity: (!mood || saving) ? 0.3 : 1,
        }}
      >
        {saving ? "Saving..." : mood ? `Log ${MOOD_EMOJI[mood]} ${mood}` : "Pick a mood to log"}
      </button>
    </div>
  );
}
