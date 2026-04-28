"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { parseISO, getDay, subDays, isAfter } from "date-fns";
import { MOOD_COLORS } from "@/lib/mood";
import { useChartTheme } from "@/lib/chartTheme";

interface Entry {
  date: string;
  mood: string;
  moodScore: number;
  activities: string[] | null;
}

interface Insight {
  title: string;
  body: string;
  category: "mood" | "health" | "finance" | "pattern";
  sentiment: "positive" | "neutral" | "negative";
}

interface InsightsData {
  summary: string;
  insights: Insight[];
  generatedAt: string;
}

const CATEGORY_ICON: Record<string, string> = {
  mood: "🧠", health: "💪", finance: "💰", pattern: "🔍",
};

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "var(--c-positive)",
  neutral: "var(--c-primary)",
  negative: "var(--c-negative)",
};

const SENTIMENT_BG: Record<string, string> = {
  positive: "var(--c-positive-dim)",
  neutral: "var(--c-primary-dim)",
  negative: "var(--c-negative-dim)",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MOOD_ORDER = ["rad", "good", "meh", "bad", "awful"] as const;

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="rounded-2xl p-4" style={{
      background: SENTIMENT_BG[insight.sentiment],
      border: `1px solid ${SENTIMENT_COLOR[insight.sentiment]}30`,
    }}>
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5 flex-shrink-0">{CATEGORY_ICON[insight.category]}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm mb-1" style={{ color: SENTIMENT_COLOR[insight.sentiment] }}>
            {insight.title}
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
            {insight.body}
          </p>
        </div>
      </div>
    </div>
  );
}

function CorrelationBar({ label, high, low, highLabel, lowLabel }: {
  label: string; high: number; low: number; highLabel: string; lowLabel: string;
}) {
  const diff = high - low;
  const isPositive = diff > 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{label}</span>
        <span className="text-xs font-semibold" style={{ color: isPositive ? "var(--c-positive)" : "var(--c-negative)" }}>
          {isPositive ? "+" : ""}{diff.toFixed(2)} pts
        </span>
      </div>
      {[{ label: highLabel, val: high, primary: true }, { label: lowLabel, val: low, primary: false }].map(({ label: l, val, primary }) => (
        <div key={l} className="flex gap-2 items-center mb-0.5">
          <span className="text-[10px] w-20 text-right flex-shrink-0" style={{ color: "var(--text-muted)" }}>{l}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--divider)" }}>
            <div className="h-full rounded-full" style={{
              width: `${(val / 5) * 100}%`,
              background: primary ? "linear-gradient(90deg, var(--c-primary), var(--c-secondary))" : "var(--text-muted)",
            }} />
          </div>
          <span className="text-[10px] w-8 flex-shrink-0" style={{ color: "var(--text-dim)" }}>{val.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

export default function InsightsSection({ entries }: { entries: Entry[] }) {
  const [aiData, setAiData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useChartTheme();

  async function loadInsights() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/insights");
      if (!r.ok) throw new Error("Failed");
      setAiData(await r.json());
    } catch {
      setError("Couldn't load insights. Tap refresh to try again.");
    }
    setLoading(false);
  }

  useEffect(() => { loadInsights(); }, []);

  if (entries.length < 7) return <p className="text-sm" style={{ color: "var(--text-dim)" }}>Not enough data yet.</p>;

  // ── Local stats ──────────────────────────────────────────────────────────────
  const now = new Date();

  // Day of week
  const dowMap: Record<number, { total: number; count: number }> = {};
  for (const e of entries) {
    const d = getDay(parseISO(e.date));
    if (!dowMap[d]) dowMap[d] = { total: 0, count: 0 };
    dowMap[d].total += e.moodScore; dowMap[d].count++;
  }
  const dowData = DAYS.map((day, i) => ({ day, avg: dowMap[i] ? +(dowMap[i].total / dowMap[i].count).toFixed(2) : 0 }));
  const bestDow = [...dowData].filter(d => d.avg > 0).sort((a, b) => b.avg - a.avg)[0];

  // Activity correlations
  const actMap: Record<string, { total: number; count: number }> = {};
  for (const e of entries) {
    for (const a of e.activities ?? []) {
      if (!actMap[a]) actMap[a] = { total: 0, count: 0 };
      actMap[a].total += e.moodScore; actMap[a].count++;
    }
  }
  const topActivities = Object.entries(actMap)
    .filter(([, v]) => v.count >= 5)
    .map(([name, v]) => ({ name, avg: v.total / v.count, count: v.count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 6);

  // Lagged correlations
  const activityDates: Record<string, Set<string>> = {};
  for (const e of entries) {
    for (const a of e.activities ?? []) {
      if (!activityDates[a]) activityDates[a] = new Set();
      activityDates[a].add(e.date);
    }
  }

  function laggedCorr(activity: string) {
    const withAct: number[] = [], without: number[] = [];
    for (const e of entries) {
      const d = parseISO(e.date);
      const had = [1, 2].some(lag => activityDates[activity]?.has(subDays(d, lag).toISOString().split("T")[0]));
      if (had) withAct.push(e.moodScore); else without.push(e.moodScore);
    }
    if (withAct.length < 5 || without.length < 5) return null;
    return { after: withAct.reduce((s, v) => s + v, 0) / withAct.length, baseline: without.reduce((s, v) => s + v, 0) / without.length };
  }

  const laggedKeys = ["exercise", "no alcohol", "no drugs", "anxiety attack", "sick"];
  const laggedResults = laggedKeys.map(key => {
    const r = laggedCorr(key);
    if (!r || Math.abs(r.after - r.baseline) < 0.08) return null;
    return { key, label: key.charAt(0).toUpperCase() + key.slice(1), ...r };
  }).filter(Boolean);

  // Mood distribution
  const dist: Record<string, number> = { rad: 0, good: 0, meh: 0, bad: 0, awful: 0 };
  for (const e of entries) dist[e.mood] = (dist[e.mood] ?? 0) + 1;

  return (
    <div className="space-y-5">
      {/* AI Insights header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>AI Analysis</p>
          {aiData?.generatedAt && (
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              Updated {new Date(aiData.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <button
          onClick={loadInsights}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-xl transition-all disabled:opacity-40"
          style={{ background: "var(--c-primary-dim)", color: "var(--c-primary)", border: "1px solid var(--c-primary-border)" }}
        >
          {loading ? "Analysing…" : "↻ Refresh"}
        </button>
      </div>

      {/* Summary banner */}
      {loading && !aiData && (
        <div className="rounded-2xl p-5 text-center space-y-2" style={{ background: "var(--c-primary-dim)", border: "1px solid var(--c-primary-border)" }}>
          <div className="inline-flex gap-1.5">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--c-primary)", animationDelay: `${d}ms` }} />
            ))}
          </div>
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>Analysing your data…</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl p-4 text-center" style={{ background: "var(--c-negative-dim)" }}>
          <p className="text-sm" style={{ color: "var(--c-negative)" }}>{error}</p>
        </div>
      )}

      {aiData && (
        <>
          {/* Summary */}
          <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>{aiData.summary}</p>
          </div>

          {/* Insight cards */}
          <div className="space-y-3">
            {aiData.insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))}
          </div>
        </>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: "var(--divider)" }} />

      {/* Day of week */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: "var(--text-muted)" }}>Mood by Day</p>
        <div className="glass rounded-2xl p-4">
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={dowData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barSize={22}>
              <XAxis dataKey="day" tick={theme.tick} tickLine={false} axisLine={false} />
              <YAxis domain={[2, 5]} tick={theme.tick} tickLine={false} axisLine={false} width={28} hide />
              <Tooltip contentStyle={theme.tooltip} formatter={(v) => [Number(v).toFixed(2), "avg mood"]} />
              <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                {dowData.map((d) => (
                  <Cell key={d.day} fill={d.day === bestDow?.day ? "var(--c-primary)" : "var(--divider)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-center mt-1" style={{ color: "var(--text-muted)" }}>
            Best: <span style={{ color: "var(--text-dim)" }}>{bestDow?.day} ({bestDow?.avg.toFixed(1)})</span>
          </p>
        </div>
      </div>

      {/* Mood distribution */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: "var(--text-muted)" }}>Mood Split · 90 days</p>
        <div className="glass rounded-2xl p-4">
          <div className="flex gap-1 h-8 rounded-xl overflow-hidden mb-3">
            {MOOD_ORDER.map(m => {
              const pct = entries.length ? (dist[m] ?? 0) / entries.length * 100 : 0;
              return pct > 0 ? (
                <div key={m} style={{ width: `${pct}%`, background: MOOD_COLORS[m], borderRadius: 0 }} title={`${m}: ${pct.toFixed(0)}%`} />
              ) : null;
            })}
          </div>
          <div className="flex gap-2 flex-wrap">
            {MOOD_ORDER.map(m => (
              <div key={m} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: MOOD_COLORS[m] }} />
                <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>{m} {entries.length ? Math.round((dist[m] ?? 0) / entries.length * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lagged effects */}
      {laggedResults.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: "var(--text-muted)" }}>Next-Day Effects</p>
          <div className="glass rounded-2xl p-4 space-y-3">
            {laggedResults.map(r => r && (
              <CorrelationBar
                key={r.key}
                label={r.label}
                high={r.after}
                low={r.baseline}
                highLabel="day after"
                lowLabel="other days"
              />
            ))}
          </div>
        </div>
      )}

      {/* Top activities */}
      {topActivities.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: "var(--text-muted)" }}>Activities & Mood</p>
          <div className="glass rounded-2xl p-4 space-y-2.5">
            {topActivities.map(({ name, avg, count }) => (
              <div key={name} className="flex items-center gap-3">
                <div className="text-xs truncate" style={{ color: "var(--text-dim)", width: 100 }}>{name}</div>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--divider)" }}>
                  <div className="h-full rounded-full" style={{
                    width: `${((avg - 1) / 4) * 100}%`,
                    background: "linear-gradient(90deg, var(--c-primary), var(--c-secondary))",
                  }} />
                </div>
                <div className="text-[10px] text-right flex-shrink-0" style={{ color: "var(--text-muted)", width: 52 }}>{avg.toFixed(1)} · {count}×</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
