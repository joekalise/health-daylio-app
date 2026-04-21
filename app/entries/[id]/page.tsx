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

export default function EntryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/mood/${id}`)
      .then((r) => r.json())
      .then((d) => { setEntry(d); setLoading(false); });
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-500 text-sm">Loading...</p>
    </div>
  );

  if (!entry || "error" in entry) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-500 text-sm">Entry not found.</p>
    </div>
  );

  const color = MOOD_COLORS[entry.mood] ?? "#6366f1";

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-lg mx-auto px-4 pt-6 pb-12">
        <button onClick={() => router.back()} className="text-xs text-zinc-500 hover:text-zinc-300 mb-6 flex items-center gap-1 transition-colors">
          ← Back
        </button>

        <div className="bg-zinc-900 rounded-2xl p-6 space-y-5">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="text-6xl">{MOOD_EMOJI[entry.mood]}</div>
            <div className="text-xl font-semibold capitalize" style={{ color }}>{entry.mood}</div>
            <div className="text-sm text-zinc-400">{format(parseISO(entry.date), "EEEE, MMMM d, yyyy")}</div>
            {entry.time && <div className="text-xs text-zinc-600">{entry.time}</div>}
          </div>

          {/* Mood score bar */}
          <div>
            <div className="flex justify-between text-xs text-zinc-600 mb-1">
              <span>Mood score</span>
              <span>{entry.moodScore}/5</span>
            </div>
            <div className="bg-zinc-800 rounded-full h-2">
              <div className="h-full rounded-full transition-all" style={{ width: `${(entry.moodScore / 5) * 100}%`, backgroundColor: color }} />
            </div>
          </div>

          {/* Activities */}
          {entry.activities && entry.activities.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 mb-2">Activities</p>
              <div className="flex flex-wrap gap-1.5">
                {entry.activities.map((a) => (
                  <span key={a} className="text-xs bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full">{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          {entry.noteTitle && <p className="text-sm font-medium text-zinc-200">{entry.noteTitle}</p>}
          {entry.note && (
            <div>
              <p className="text-xs text-zinc-500 mb-1.5">Note</p>
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{entry.note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
