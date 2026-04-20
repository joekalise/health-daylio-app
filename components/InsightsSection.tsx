"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, RadialBarChart, RadialBar, Cell,
} from "recharts";
import { parseISO, format, getDay, getMonth, getYear, subDays, isAfter } from "date-fns";
import { MOOD_COLORS, MOOD_SCORES } from "@/lib/mood";

interface Entry {
  date: string;
  mood: string;
  moodScore: number;
  activities: string[] | null;
}

const tooltipStyle = { backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 };
const tickStyle = { fill: "#71717a", fontSize: 11 };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MOOD_ORDER = ["rad", "good", "meh", "bad", "awful"] as const;

function linearTrend(data: { x: number; y: number }[]): number {
  const n = data.length;
  if (n < 2) return 0;
  const sumX = data.reduce((s, d) => s + d.x, 0);
  const sumY = data.reduce((s, d) => s + d.y, 0);
  const sumXY = data.reduce((s, d) => s + d.x * d.y, 0);
  const sumX2 = data.reduce((s, d) => s + d.x * d.x, 0);
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-zinc-800 rounded-xl p-3 text-center">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="font-bold text-lg text-white">{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function InsightsSection({ entries }: { entries: Entry[] }) {
  if (entries.length < 7) return <p className="text-zinc-500 text-sm">Not enough data yet.</p>;

  // Mood by day of week
  const byDow = Array.from({ length: 7 }, (_, i) => ({ day: DAYS[i], total: 0, count: 0 }));
  for (const e of entries) {
    const d = getDay(parseISO(e.date));
    byDow[d].total += e.moodScore;
    byDow[d].count += 1;
  }
  const dowData = byDow.map((d) => ({ day: d.day, avg: d.count ? +(d.total / d.count).toFixed(2) : 0 }));

  // Mood by month of year
  const byMonth = Array.from({ length: 12 }, (_, i) => ({ month: MONTHS[i], total: 0, count: 0 }));
  for (const e of entries) {
    const m = getMonth(parseISO(e.date));
    byMonth[m].total += e.moodScore;
    byMonth[m].count += 1;
  }
  const monthData = byMonth.map((m) => ({ month: m.month, avg: m.count ? +(m.total / m.count).toFixed(2) : 0 }));

  // Mood distribution
  const dist: Record<string, number> = { rad: 0, good: 0, meh: 0, bad: 0, awful: 0 };
  for (const e of entries) dist[e.mood] = (dist[e.mood] ?? 0) + 1;
  const distData = MOOD_ORDER.map((m) => ({ name: m, value: dist[m] ?? 0, fill: MOOD_COLORS[m] }));

  // Top activities
  const actMap: Record<string, { total: number; count: number }> = {};
  for (const e of entries) {
    for (const a of e.activities ?? []) {
      if (!actMap[a]) actMap[a] = { total: 0, count: 0 };
      actMap[a].total += e.moodScore;
      actMap[a].count += 1;
    }
  }
  const topActivities = Object.entries(actMap)
    .filter(([, v]) => v.count >= 5)
    .map(([name, v]) => ({ name, avg: v.total / v.count, count: v.count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 8);

  // Trend: slope over last 90 days vs previous 90 days
  const now = new Date();
  const recent90 = entries.filter((e) => isAfter(parseISO(e.date), subDays(now, 90)));
  const prev90 = entries.filter((e) => {
    const d = parseISO(e.date);
    return isAfter(d, subDays(now, 180)) && !isAfter(d, subDays(now, 90));
  });
  const recentAvg = recent90.length ? recent90.reduce((s, e) => s + e.moodScore, 0) / recent90.length : null;
  const prevAvg = prev90.length ? prev90.reduce((s, e) => s + e.moodScore, 0) / prev90.length : null;
  const trendDelta = recentAvg !== null && prevAvg !== null ? recentAvg - prevAvg : null;

  // Yearly averages
  const byYear: Record<number, { total: number; count: number }> = {};
  for (const e of entries) {
    const y = getYear(parseISO(e.date));
    if (!byYear[y]) byYear[y] = { total: 0, count: 0 };
    byYear[y].total += e.moodScore;
    byYear[y].count += 1;
  }
  const yearData = Object.entries(byYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, v]) => ({ year, avg: +(v.total / v.count).toFixed(2) }));

  // Best/worst day of week
  const bestDow = [...dowData].sort((a, b) => b.avg - a.avg)[0];
  const worstDow = [...dowData].filter((d) => d.avg > 0).sort((a, b) => a.avg - b.avg)[0];

  // Best month
  const bestMonth = [...monthData].filter((m) => m.avg > 0).sort((a, b) => b.avg - a.avg)[0];

  const totalDays = entries.length;
  const overallAvg = entries.reduce((s, e) => s + e.moodScore, 0) / totalDays;

  return (
    <div className="space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Total days logged" value={totalDays.toLocaleString()} />
        <StatBox label="Overall avg mood" value={overallAvg.toFixed(2)} sub="out of 5" />
        <StatBox label="Happiest day" value={bestDow.day} sub={`avg ${bestDow.avg.toFixed(2)}`} />
        <StatBox label="Happiest month" value={bestMonth.month} sub={`avg ${bestMonth.avg.toFixed(2)}`} />
      </div>

      {/* Trend */}
      {trendDelta !== null && (
        <div className={`rounded-xl p-3 text-sm text-center ${trendDelta >= 0 ? "bg-emerald-900/30 text-emerald-400" : "bg-red-900/30 text-red-400"}`}>
          {trendDelta >= 0 ? "↑" : "↓"} Your mood is {trendDelta >= 0 ? "improving" : "declining"} — avg{" "}
          {Math.abs(trendDelta).toFixed(2)} points {trendDelta >= 0 ? "higher" : "lower"} than the previous 90 days
        </div>
      )}

      {/* Mood distribution */}
      <div>
        <h3 className="text-xs font-medium text-zinc-400 mb-3">Mood distribution</h3>
        <div className="flex gap-2">
          {distData.map(({ name, value }) => (
            <div key={name} className="flex-1 text-center">
              <div className="text-sm font-bold" style={{ color: MOOD_COLORS[name] }}>{value}</div>
              <div className="text-xs text-zinc-500 mt-0.5 capitalize">{name}</div>
              <div className="text-xs text-zinc-600">{totalDays ? Math.round((value / totalDays) * 100) : 0}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Mood by day of week */}
      <div>
        <h3 className="text-xs font-medium text-zinc-400 mb-2">Avg mood by day of week</h3>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={dowData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="day" tick={tickStyle} tickLine={false} axisLine={false} />
            <YAxis domain={[1, 5]} tick={tickStyle} tickLine={false} axisLine={false} width={36} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toFixed(2), "avg mood"]} />
            <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
              {dowData.map((d) => (
                <Cell key={d.day} fill={d.day === bestDow.day ? "#6366f1" : "#3f3f46"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Mood by month */}
      <div>
        <h3 className="text-xs font-medium text-zinc-400 mb-2">Avg mood by month</h3>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={monthData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="month" tick={tickStyle} tickLine={false} axisLine={false} />
            <YAxis domain={[1, 5]} tick={tickStyle} tickLine={false} axisLine={false} width={36} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toFixed(2), "avg mood"]} />
            <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
              {monthData.map((m) => (
                <Cell key={m.month} fill={m.month === bestMonth.month ? "#8b5cf6" : "#3f3f46"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Mood by year */}
      {yearData.length > 1 && (
        <div>
          <h3 className="text-xs font-medium text-zinc-400 mb-2">Avg mood by year</h3>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={yearData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="year" tick={tickStyle} tickLine={false} axisLine={false} />
              <YAxis domain={[1, 5]} tick={tickStyle} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toFixed(2), "avg mood"]} />
              <Bar dataKey="avg" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top activities */}
      {topActivities.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-zinc-400 mb-3">Activities associated with better mood</h3>
          <div className="space-y-2">
            {topActivities.map(({ name, avg, count }) => (
              <div key={name} className="flex items-center gap-3">
                <div className="w-28 text-xs text-zinc-300 truncate">{name}</div>
                <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${((avg - 1) / 4) * 100}%` }} />
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
