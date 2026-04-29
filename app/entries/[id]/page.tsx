"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { MOOD_EMOJI, MOOD_COLORS } from "@/lib/mood";

interface Entry {
  id: number;
  date: string;
  time: string | null;
  mood: string;
  moodScore: number;
  activities: string[] | null;
  noteTitle: string | null;
  note: string | null;
}

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

export default function EntryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editMood, setEditMood] = useState("");
  const [editActivities, setEditActivities] = useState<string[]>([]);
  const [editNote, setEditNote] = useState("");

  useEffect(() => {
    fetch(`/api/mood/${id}`)
      .then((r) => r.json())
      .then((d) => { setEntry(d); setLoading(false); });
  }, [id]);

  function startEdit() {
    if (!entry) return;
    setEditMood(entry.mood);
    setEditActivities(entry.activities ?? []);
    setEditNote(entry.note ?? "");
    setEditing(true);
  }

  function toggleActivity(a: string) {
    setEditActivities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  async function save() {
    if (!editMood || !entry) return;
    setSaving(true);
    const res = await fetch(`/api/mood/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood: editMood, activities: editActivities, note: editNote }),
    });
    const updated = await res.json();
    setEntry(updated);
    setEditing(false);
    setSaving(false);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <p className="text-sm" style={{ color: "var(--text-dim)" }}>Loading...</p>
    </div>
  );

  if (!entry || "error" in entry) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <p className="text-sm" style={{ color: "var(--text-dim)" }}>Entry not found.</p>
    </div>
  );

  const color = MOOD_COLORS[editing ? editMood : entry.mood] ?? "#6366f1";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="max-w-lg mx-auto px-4 pt-6 pb-12">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="text-xs flex items-center gap-1 transition-colors" style={{ color: "var(--text-muted)" }}>
            ← Back
          </button>
          {!editing ? (
            <button
              onClick={startEdit}
              className="text-xs px-3 py-1.5 rounded-xl transition-all"
              style={{ background: "var(--c-primary-dim)", color: "var(--c-primary)", border: "1px solid var(--c-primary-border)" }}
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded-xl" style={{ color: "var(--text-muted)", background: "var(--surface)", border: "1px solid var(--border)" }}>
                Cancel
              </button>
              <button
                onClick={save}
                disabled={!editMood || saving}
                className="text-xs px-3 py-1.5 rounded-xl font-medium disabled:opacity-40"
                style={{ background: color, color: "#fff" }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-6 space-y-5">
          {/* Date */}
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: "var(--text-dim)" }}>
              {format(parseISO(entry.date), "EEEE, MMMM d, yyyy")}
            </p>
            {entry.time && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{entry.time}</p>}
          </div>

          {/* Mood */}
          {editing ? (
            <div className="flex gap-2 justify-center">
              {MOODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setEditMood(m)}
                  className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-1.5 transition-all ${editMood === m ? "ring-2 ring-white/30 scale-105" : "opacity-50 hover:opacity-80"}`}
                  style={{ backgroundColor: MOOD_COLORS[m] + (editMood === m ? "33" : "1a") }}
                >
                  <span className="text-3xl">{MOOD_EMOJI[m]}</span>
                  <span className="text-[10px] font-medium" style={{ color: "var(--text-dim)" }}>{m}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center space-y-2">
              <div className="text-6xl">{MOOD_EMOJI[entry.mood]}</div>
              <p className="text-xl font-semibold capitalize" style={{ color }}>{entry.mood}</p>
              <div>
                <div className="flex justify-between text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                  <span>Mood score</span><span>{entry.moodScore}/5</span>
                </div>
                <div className="rounded-full h-2" style={{ background: "var(--divider)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(entry.moodScore / 5) * 100}%`, backgroundColor: color }} />
                </div>
              </div>
            </div>
          )}

          {/* Activities */}
          {editing ? (
            <div className="space-y-4">
              {ACTIVITY_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>{group.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((a) => (
                      <button
                        key={a}
                        onClick={() => toggleActivity(a)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                        style={editActivities.includes(a)
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
          ) : (
            entry.activities && entry.activities.length > 0 && (
              <div>
                <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Activities</p>
                <div className="flex flex-wrap gap-1.5">
                  {entry.activities.map((a) => (
                    <span key={a} className="text-xs px-3 py-1 rounded-full" style={{ background: "var(--chip-bg)", border: "1px solid var(--chip-border)", color: "var(--text-dim)" }}>{a}</span>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Note */}
          {editing ? (
            <textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Add a note… (optional)"
              rows={3}
              className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--chip-border)", color: "var(--text)" }}
            />
          ) : (
            <>
              {entry.noteTitle && <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{entry.noteTitle}</p>}
              {entry.note && (
                <div>
                  <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>Note</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-dim)" }}>{entry.note}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
