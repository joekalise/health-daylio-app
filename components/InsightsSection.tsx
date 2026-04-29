"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { parseISO, getDay, subDays } from "date-fns";
import { MOOD_COLORS } from "@/lib/mood";
import { useChartTheme } from "@/lib/chartTheme";

interface HealthMetric {
  id: number;
  date: string;
  type: string;
  value: number;
  unit: string | null;
}

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

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
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
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const theme = useChartTheme();

  async function loadInsights() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/insights");
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      setAiData(data);
      try { sessionStorage.setItem("insights_cache", JSON.stringify(data)); } catch {}
    } catch (e) {
      // Keep last cached result if available
      try {
        const cached = sessionStorage.getItem("insights_cache");
        if (cached) { setAiData(JSON.parse(cached)); setError(`Showing cached result (${e instanceof Error ? e.message : "error"}) — tap refresh to retry.`); }
        else setError(`Failed: ${e instanceof Error ? e.message : "unknown error"}. Tap refresh to try again.`);
      } catch { setError("Couldn't load insights. Tap refresh to try again."); }
    }
    setLoading(false);
  }

  useEffect(() => {
    // Load from cache immediately while fetching
    try {
      const cached = sessionStorage.getItem("insights_cache");
      if (cached) setAiData(JSON.parse(cached));
    } catch {}
  }, []);

  useEffect(() => { loadInsights(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/health/metrics?days=90")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setHealthMetrics(d); })
      .catch(() => {});
  }, []);

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

  // ── Sleep × Mood correlation ──────────────────────────────────────────────────
  const sleepByDate: Record<string, number> = {};
  for (const m of healthMetrics) {
    if (m.type === "sleep_total") sleepByDate[m.date] = m.value;
  }
  const sleepMoodPairs: Array<{ hrs: number; mood: number }> = [];
  for (const e of entries) {
    const hrs = sleepByDate[e.date] ?? sleepByDate[subDays(parseISO(e.date), 1).toISOString().split("T")[0]];
    if (hrs === undefined || hrs <= 0) continue;
    sleepMoodPairs.push({ hrs, mood: e.moodScore });
  }
  const avgArr = (a: number[]) => a.length ? +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(2) : null;
  let sleepCorr: { good: number; poor: number; nGood: number; nPoor: number; threshold: number } | null = null;
  if (sleepMoodPairs.length >= 10) {
    const sorted = [...sleepMoodPairs].sort((a, b) => a.hrs - b.hrs);
    const medianHrs = sorted[Math.floor(sorted.length / 2)].hrs;
    const goodPairs = sleepMoodPairs.filter(p => p.hrs > medianHrs);
    const poorPairs = sleepMoodPairs.filter(p => p.hrs <= medianHrs);
    const goodAvg = avgArr(goodPairs.map(p => p.mood));
    const poorAvg = avgArr(poorPairs.map(p => p.mood));
    if (goodAvg !== null && poorAvg !== null) {
      sleepCorr = { good: goodAvg, poor: poorAvg, nGood: goodPairs.length, nPoor: poorPairs.length, threshold: +medianHrs.toFixed(1) };
    }
  }

  // ── HRV trend (stress proxy) ──────────────────────────────────────────────────
  const d14 = subDays(now, 14).toISOString().split("T")[0];
  const d28 = subDays(now, 28).toISOString().split("T")[0];
  const recentHrv = healthMetrics.filter(m => m.type === "hrv" && m.date >= d14);
  const prevHrv = healthMetrics.filter(m => m.type === "hrv" && m.date >= d28 && m.date < d14);
  const recentHrvAvg = avgArr(recentHrv.map(m => m.value));
  const prevHrvAvg = avgArr(prevHrv.map(m => m.value));
  const hrvTrend = recentHrvAvg !== null && prevHrvAvg !== null
    ? { recent: recentHrvAvg, prev: prevHrvAvg, delta: +(recentHrvAvg - prevHrvAvg).toFixed(1) }
    : null;

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

      {/* Sleep × Mood */}
      {sleepCorr && (
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: "var(--text-muted)" }}>Sleep vs Mood</p>
          <div className="glass rounded-2xl p-4">
            <CorrelationBar
              label="Sleep quality"
              high={sleepCorr.good}
              low={sleepCorr.poor}
              highLabel={`>${sleepCorr.threshold}h (${sleepCorr.nGood} nights)`}
              lowLabel={`≤${sleepCorr.threshold}h (${sleepCorr.nPoor} nights)`}
            />
            <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
              {sleepCorr.good > sleepCorr.poor
                ? `Sleeping more than ${sleepCorr.threshold}h is linked to +${(sleepCorr.good - sleepCorr.poor).toFixed(1)} pts better mood for you`
                : `Short sleep nights (≤${sleepCorr.threshold}h) don't show a clear mood penalty in your data yet`}
            </p>
          </div>
        </div>
      )}

      {/* HRV trend */}
      {hrvTrend && (
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: "var(--text-muted)" }}>HRV · Stress Signal</p>
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-2xl font-bold" style={{ color: hrvTrend.delta >= 0 ? "var(--c-positive)" : "var(--c-negative)" }}>
                  {hrvTrend.recent.toFixed(0)} ms
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>14-day avg HRV</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold" style={{ color: hrvTrend.delta >= 0 ? "var(--c-positive)" : "var(--c-negative)" }}>
                  {hrvTrend.delta >= 0 ? "↑" : "↓"} {Math.abs(hrvTrend.delta)} ms
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>vs prior 2 weeks</p>
              </div>
            </div>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {hrvTrend.delta <= -5
                ? "HRV dropping — your nervous system is under more stress than usual. Prioritise recovery."
                : hrvTrend.delta >= 5
                  ? "HRV improving — your body is recovering well. Keep it up."
                  : "HRV stable — stress load roughly unchanged from last fortnight."}
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
