"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ScatterChart, Scatter, LineChart, Line } from "recharts";
import { parseISO, getDay, getMonth, getYear, subDays, isAfter, differenceInCalendarDays } from "date-fns";
import { MOOD_COLORS } from "@/lib/mood";

interface Entry {
  date: string;
  mood: string;
  moodScore: number;
  activities: string[] | null;
}

interface HealthRow {
  date: string;
  type: string;
  value: number;
}

const tooltipStyle = { backgroundColor: "#07070f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10 };
const tickStyle = { fill: "#52525b", fontSize: 11 };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MOOD_ORDER = ["rad", "good", "meh", "bad", "awful"] as const;

function StatBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="font-bold text-base" style={{ color: color ?? "#fff" }}>{value}</div>
      {sub && <div className="text-xs text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">{title}</h3>;
}

function CorrelationBar({ label, high, low, highLabel, lowLabel }: { label: string; high: number; low: number; highLabel: string; lowLabel: string }) {
  const diff = high - low;
  const isPositive = diff > 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className={`text-xs font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
          {isPositive ? "+" : ""}{diff.toFixed(2)} mood pts
        </span>
      </div>
      <div className="flex gap-2 items-center">
        <span className="text-[10px] text-zinc-600 w-20 text-right">{highLabel}</span>
        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${(high / 5) * 100}%`, background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }} />
        </div>
        <span className="text-[10px] text-zinc-500">{high.toFixed(2)}</span>
      </div>
      <div className="flex gap-2 items-center mt-0.5">
        <span className="text-[10px] text-zinc-600 w-20 text-right">{lowLabel}</span>
        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full bg-zinc-600" style={{ width: `${(low / 5) * 100}%` }} />
        </div>
        <span className="text-[10px] text-zinc-500">{low.toFixed(2)}</span>
      </div>
    </div>
  );
}

export default function InsightsSection({ entries }: { entries: Entry[] }) {
  const [healthData, setHealthData] = useState<HealthRow[]>([]);

  useEffect(() => {
    fetch("/api/health/metrics?days=1825")
      .then(r => r.json())
      .then(d => setHealthData(Array.isArray(d) ? d : []));
  }, []);

  if (entries.length < 7) return <p className="text-zinc-500 text-sm">Not enough data yet.</p>;

  const now = new Date();
  const totalDays = entries.length;
  const overallAvg = entries.reduce((s, e) => s + e.moodScore, 0) / totalDays;

  // Consistency score
  const firstEntry = entries[entries.length - 1];
  const daysSinceFirst = differenceInCalendarDays(now, parseISO(firstEntry.date));
  const consistencyPct = daysSinceFirst > 0 ? Math.round((totalDays / daysSinceFirst) * 100) : 100;

  // Mood momentum (30d vs prev 30d)
  const recent30 = entries.filter(e => isAfter(parseISO(e.date), subDays(now, 30)));
  const prev30 = entries.filter(e => {
    const d = parseISO(e.date);
    return isAfter(d, subDays(now, 60)) && !isAfter(d, subDays(now, 30));
  });
  const recent30Avg = recent30.length ? recent30.reduce((s, e) => s + e.moodScore, 0) / recent30.length : null;
  const prev30Avg = prev30.length ? prev30.reduce((s, e) => s + e.moodScore, 0) / prev30.length : null;
  const momentum = recent30Avg !== null && prev30Avg !== null ? recent30Avg - prev30Avg : null;

  // 90d vs prev 90d
  const recent90 = entries.filter(e => isAfter(parseISO(e.date), subDays(now, 90)));
  const prev90 = entries.filter(e => { const d = parseISO(e.date); return isAfter(d, subDays(now, 180)) && !isAfter(d, subDays(now, 90)); });
  const recent90Avg = recent90.length ? recent90.reduce((s, e) => s + e.moodScore, 0) / recent90.length : null;
  const prev90Avg = prev90.length ? prev90.reduce((s, e) => s + e.moodScore, 0) / prev90.length : null;
  const trendDelta = recent90Avg !== null && prev90Avg !== null ? recent90Avg - prev90Avg : null;

  // By day of week
  const byDow = Array.from({ length: 7 }, (_, i) => ({ day: DAYS[i], total: 0, count: 0 }));
  for (const e of entries) { const d = getDay(parseISO(e.date)); byDow[d].total += e.moodScore; byDow[d].count++; }
  const dowData = byDow.map(d => ({ day: d.day, avg: d.count ? +(d.total / d.count).toFixed(2) : 0 }));
  const bestDow = [...dowData].sort((a, b) => b.avg - a.avg)[0];
  const worstDow = [...dowData].filter(d => d.avg > 0).sort((a, b) => a.avg - b.avg)[0];

  // By month
  const byMonth = Array.from({ length: 12 }, (_, i) => ({ month: MONTHS[i], total: 0, count: 0 }));
  for (const e of entries) { const m = getMonth(parseISO(e.date)); byMonth[m].total += e.moodScore; byMonth[m].count++; }
  const monthData = byMonth.map(m => ({ month: m.month, avg: m.count ? +(m.total / m.count).toFixed(2) : 0 }));
  const bestMonth = [...monthData].filter(m => m.avg > 0).sort((a, b) => b.avg - a.avg)[0];

  // By year
  const byYear: Record<number, { total: number; count: number }> = {};
  for (const e of entries) {
    const y = getYear(parseISO(e.date));
    if (!byYear[y]) byYear[y] = { total: 0, count: 0 };
    byYear[y].total += e.moodScore; byYear[y].count++;
  }
  const yearData = Object.entries(byYear).sort(([a], [b]) => Number(a) - Number(b)).map(([year, v]) => ({ year, avg: +(v.total / v.count).toFixed(2) }));

  // Mood distribution
  const dist: Record<string, number> = { rad: 0, good: 0, meh: 0, bad: 0, awful: 0 };
  for (const e of entries) dist[e.mood] = (dist[e.mood] ?? 0) + 1;

  // Top activities
  const actMap: Record<string, { total: number; count: number }> = {};
  for (const e of entries) {
    for (const a of e.activities ?? []) {
      if (!actMap[a]) actMap[a] = { total: 0, count: 0 };
      actMap[a].total += e.moodScore; actMap[a].count++;
    }
  }
  const topActivities = Object.entries(actMap).filter(([, v]) => v.count >= 5).map(([name, v]) => ({ name, avg: v.total / v.count, count: v.count })).sort((a, b) => b.avg - a.avg).slice(0, 8);
  const worstActivities = Object.entries(actMap).filter(([, v]) => v.count >= 5).map(([name, v]) => ({ name, avg: v.total / v.count, count: v.count })).sort((a, b) => a.avg - b.avg).slice(0, 3);

  // ── Lagged correlations (mood X days AFTER activity) ────────────────────────
  const entryByDate: Record<string, Entry> = {};
  for (const e of entries) entryByDate[e.date] = e;

  function laggedCorr(activity: string, lagDays: number[]) {
    const withActivity: number[] = [];
    const baseline: number[] = [];
    const activityDates = new Set(entries.filter(e => (e.activities ?? []).includes(activity)).map(e => e.date));

    for (const e of entries) {
      const d = parseISO(e.date);
      const hadActivity = lagDays.some(lag => {
        const prior = subDays(d, lag).toISOString().split("T")[0];
        return activityDates.has(prior);
      });
      if (hadActivity) withActivity.push(e.moodScore);
      else baseline.push(e.moodScore);
    }
    if (withActivity.length < 5 || baseline.length < 5) return null;
    return {
      after: withActivity.reduce((s, v) => s + v, 0) / withActivity.length,
      baseline: baseline.reduce((s, v) => s + v, 0) / baseline.length,
      n: withActivity.length,
    };
  }

  const LAGGED_ACTIVITIES = [
    { key: "exercise", label: "Exercise", positive: true },
    { key: "no alcohol", label: "No alcohol", positive: true },
    { key: "no drugs", label: "No drugs", positive: true },
    { key: "anxiety attack", label: "Anxiety attack", positive: false },
    { key: "sick", label: "Sick", positive: false },
    { key: "alcohol", label: "Alcohol", positive: false },
    { key: "drugs", label: "Drugs", positive: false },
  ];

  const laggedResults = LAGGED_ACTIVITIES.map(({ key, label, positive }) => {
    const r = laggedCorr(key, [1, 2]);
    if (!r) return null;
    const diff = r.after - r.baseline;
    if (Math.abs(diff) < 0.05) return null;
    return { label, diff, after: r.after, baseline: r.baseline, n: r.n, positive };
  }).filter(Boolean).sort((a, b) => Math.abs(b!.diff) - Math.abs(a!.diff));

  // ── Health / mood correlations ──────────────────────────────────────────────
  const moodByDate: Record<string, number> = {};
  for (const e of entries) moodByDate[e.date] = e.moodScore;

  function correlate(type: string, threshold: (v: number) => boolean) {
    const values = healthData.filter(h => h.type === type);
    if (values.length < 10) return null;
    const median = [...values].sort((a, b) => a.value - b.value)[Math.floor(values.length / 2)].value;
    const high: number[] = [], low: number[] = [];
    for (const h of values) {
      const mood = moodByDate[h.date];
      if (mood == null) continue;
      (threshold(h.value) ? high : low).push(mood);
    }
    if (high.length < 5 || low.length < 5) return null;
    return {
      highAvg: high.reduce((s, v) => s + v, 0) / high.length,
      lowAvg: low.reduce((s, v) => s + v, 0) / low.length,
      median,
    };
  }

  const sleepCorr = correlate("sleep_total", v => v >= 7);
  const stepsCorr = correlate("steps", v => v >= 8000);
  const hrvCorr = correlate("hrv", v => {
    const vals = healthData.filter(h => h.type === "hrv");
    const med = vals.length ? [...vals].sort((a, b) => a.value - b.value)[Math.floor(vals.length / 2)].value : 0;
    return v >= med;
  });

  return (
    <div className="space-y-6">
      {/* Hero stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Total days logged" value={totalDays.toLocaleString()} color="#a5b4fc" />
        <StatBox label="Overall avg mood" value={overallAvg.toFixed(2)} sub="out of 5" color="#c4b5fd" />
        <StatBox label="Consistency" value={`${consistencyPct}%`} sub="days logged" color="#4ade80" />
        <StatBox label="Happiest day" value={bestDow?.day ?? "—"} sub={bestDow ? `avg ${bestDow.avg.toFixed(2)}` : undefined} color="#fb923c" />
      </div>

      {/* Momentum banner */}
      {momentum !== null && (
        <div className="rounded-2xl p-4" style={{
          background: momentum >= 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${momentum >= 0 ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
        }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: momentum >= 0 ? "#86efac" : "#fca5a5" }}>
                {momentum >= 0 ? "📈 Mood improving" : "📉 Mood declining"}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {Math.abs(momentum).toFixed(2)} points {momentum >= 0 ? "higher" : "lower"} vs previous 30 days
              </p>
            </div>
            <div className="text-2xl font-bold" style={{ color: momentum >= 0 ? "#4ade80" : "#f87171" }}>
              {momentum >= 0 ? "+" : ""}{momentum.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Delayed effects (lagged correlations) */}
      {laggedResults.length > 0 && (
        <div>
          <SectionHeader title="Delayed effects (1–2 days later)" />
          <div className="glass rounded-2xl p-4 space-y-1">
            {laggedResults.map((r) => r && (
              <CorrelationBar
                key={r.label}
                label={r.label}
                high={r.after}
                low={r.baseline}
                highLabel="days after"
                lowLabel="other days"
              />
            ))}
          </div>
          <p className="text-[10px] text-zinc-600 mt-2 px-1">Mood 1–2 days after each activity vs days with no recent history of it</p>
        </div>
      )}

      {/* Health → Mood correlations */}
      {(sleepCorr || stepsCorr || hrvCorr) && (
        <div>
          <SectionHeader title="What affects your mood" />
          <div className="glass rounded-2xl p-4 space-y-1">
            {sleepCorr && (
              <CorrelationBar
                label="Sleep"
                high={sleepCorr.highAvg}
                low={sleepCorr.lowAvg}
                highLabel="7h+ sleep"
                lowLabel="<7h sleep"
              />
            )}
            {stepsCorr && (
              <CorrelationBar
                label="Steps"
                high={stepsCorr.highAvg}
                low={stepsCorr.lowAvg}
                highLabel="8k+ steps"
                lowLabel="<8k steps"
              />
            )}
            {hrvCorr && (
              <CorrelationBar
                label="HRV"
                high={hrvCorr.highAvg}
                low={hrvCorr.lowAvg}
                highLabel="High HRV"
                lowLabel="Low HRV"
              />
            )}
          </div>
        </div>
      )}

      {/* Mood distribution */}
      <div>
        <SectionHeader title="Mood distribution" />
        <div className="glass rounded-2xl p-4 flex gap-2">
          {MOOD_ORDER.map((m) => {
            const v = dist[m] ?? 0;
            const p = totalDays ? Math.round((v / totalDays) * 100) : 0;
            return (
              <div key={m} className="flex-1 text-center">
                <div className="text-sm font-bold" style={{ color: MOOD_COLORS[m] }}>{v}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5 capitalize">{m}</div>
                <div className="text-[10px] text-zinc-600">{p}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day of week */}
      <div>
        <SectionHeader title="Mood by day of week" />
        <div className="glass rounded-2xl p-4">
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={dowData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={tickStyle} tickLine={false} axisLine={false} />
              <YAxis domain={[1, 5]} tick={tickStyle} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toFixed(2), "avg mood"]} />
              <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                {dowData.map((d) => <Cell key={d.day} fill={d.day === bestDow?.day ? "#6366f1" : "rgba(255,255,255,0.08)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-zinc-600 text-center mt-1">
            Best: <span className="text-zinc-400">{bestDow?.day}</span> · Worst: <span className="text-zinc-400">{worstDow?.day}</span>
          </p>
        </div>
      </div>

      {/* Month of year */}
      <div>
        <SectionHeader title="Mood by month" />
        <div className="glass rounded-2xl p-4">
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={monthData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={tickStyle} tickLine={false} axisLine={false} />
              <YAxis domain={[1, 5]} tick={tickStyle} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toFixed(2), "avg mood"]} />
              <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                {monthData.map((m) => <Cell key={m.month} fill={m.month === bestMonth?.month ? "#8b5cf6" : "rgba(255,255,255,0.08)"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Year over year */}
      {yearData.length > 1 && (
        <div>
          <SectionHeader title="Year over year" />
          <div className="glass rounded-2xl p-4">
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={yearData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="year" tick={tickStyle} tickLine={false} axisLine={false} />
                <YAxis domain={[1, 5]} tick={tickStyle} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toFixed(2), "avg mood"]} />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                  {yearData.map((y, i) => <Cell key={y.year} fill={i === yearData.length - 1 ? "#22c55e" : "rgba(255,255,255,0.12)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top & worst activities */}
      {topActivities.length > 0 && (
        <div>
          <SectionHeader title="Activities & mood" />
          <div className="glass rounded-2xl p-4 space-y-2">
            {topActivities.map(({ name, avg, count }) => (
              <div key={name} className="flex items-center gap-3">
                <div className="w-28 text-xs text-zinc-300 truncate">{name}</div>
                <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${((avg - 1) / 4) * 100}%`, background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }} />
                </div>
                <div className="text-xs text-zinc-500 w-16 text-right">{avg.toFixed(2)} · {count}×</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Worst days */}
      {worstActivities.length > 0 && (
        <div>
          <SectionHeader title="Activities associated with lower mood" />
          <div className="glass rounded-2xl p-4 space-y-2">
            {worstActivities.map(({ name, avg, count }) => (
              <div key={name} className="flex items-center gap-3">
                <div className="w-28 text-xs text-zinc-400 truncate">{name}</div>
                <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full bg-red-500/50" style={{ width: `${((avg - 1) / 4) * 100}%` }} />
                </div>
                <div className="text-xs text-zinc-500 w-16 text-right">{avg.toFixed(2)} · {count}×</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
