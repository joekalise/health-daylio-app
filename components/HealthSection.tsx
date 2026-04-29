"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { format, parseISO, startOfWeek } from "date-fns";
import { useChartTheme } from "@/lib/chartTheme";

function smooth(data: { date: string; value: number }[], days: number) {
  if (days <= 60) return data;
  const weeks: Record<string, { total: number; count: number }> = {};
  for (const d of data) {
    const key = startOfWeek(parseISO(d.date), { weekStartsOn: 1 }).toISOString().split("T")[0];
    if (!weeks[key]) weeks[key] = { total: 0, count: 0 };
    weeks[key].total += d.value;
    weeks[key].count++;
  }
  return Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).map(([date, { total, count }]) => ({ date, value: total / count }));
}

function smoothSleep(data: { date: string; deep: number; rem: number; core: number }[], days: number) {
  if (days <= 60) return data;
  const weeks: Record<string, { deep: number; rem: number; core: number; count: number }> = {};
  for (const d of data) {
    const key = startOfWeek(parseISO(d.date), { weekStartsOn: 1 }).toISOString().split("T")[0];
    if (!weeks[key]) weeks[key] = { deep: 0, rem: 0, core: 0, count: 0 };
    weeks[key].deep += d.deep; weeks[key].rem += d.rem; weeks[key].core += d.core; weeks[key].count++;
  }
  return Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, deep: v.deep / v.count, rem: v.rem / v.count, core: v.core / v.count }));
}

function dateFormat(days: number) {
  return days <= 60 ? "MMM d" : days <= 365 ? "MMM" : "MMM yy";
}

interface Metric {
  id: number;
  date: string;
  type: string;
  value: number;
  unit: string | null;
  metadata: Record<string, number | null> | null;
}

function groupByDate(rows: Metric[], type: string) {
  return rows
    .filter((r) => r.type === type)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function avg(rows: Metric[]) {
  if (!rows.length) return null;
  return rows.reduce((s, r) => s + r.value, 0) / rows.length;
}

function MiniChart({ data, color, unit, formatter, gradientId, days }: {
  data: { date: string; value: number }[];
  color: string;
  unit: string;
  formatter?: (v: number) => string;
  gradientId: string;
  days: number;
}) {
  const theme = useChartTheme();
  if (!data.length) return <p className="text-xs" style={{ color: "var(--text-muted)" }}>No data</p>;
  const chartData = smooth(data, days);
  const fmt = dateFormat(days);
  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={(d) => format(parseISO(d), fmt)} tick={theme.tick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={theme.tick} tickLine={false} axisLine={false} width={36} tickFormatter={formatter} />
        <Tooltip
          contentStyle={theme.tooltip}
          labelFormatter={(d) => format(parseISO(d as string), "MMM d, yyyy")}
          formatter={(v) => [(formatter ? formatter(Number(v)) : Number(v).toFixed(1)) + " " + unit, ""]}
        />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function SleepBar({ data, days }: { data: Metric[]; days: number }) {
  const theme = useChartTheme();
  const raw = data
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ date: r.date, deep: r.metadata?.deep ?? 0, rem: r.metadata?.rem ?? 0, core: r.metadata?.core ?? 0 }));

  if (!raw.length) return <p className="text-xs" style={{ color: "var(--text-muted)" }}>No data</p>;
  const chartData = smoothSleep(raw, days);
  const fmt = dateFormat(days);
  const barSize = days <= 30 ? 12 : days <= 90 ? 6 : 4;

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barSize={barSize}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={(d) => format(parseISO(d), fmt)} tick={theme.tick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={theme.tick} tickLine={false} axisLine={false} width={36} />
        <Tooltip
          contentStyle={theme.tooltip}
          labelFormatter={(d) => format(parseISO(d as string), "MMM d, yyyy")}
          formatter={(v) => [Number(v).toFixed(1) + " hr", ""]}
        />
        <Bar dataKey="deep" stackId="a" fill="#6366f1" name="Deep" radius={[0, 0, 0, 0]} />
        <Bar dataKey="rem" stackId="a" fill="#8b5cf6" name="REM" />
        <Bar dataKey="core" stackId="a" fill="#a78bfa" name="Core" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function StatCard({ label, value, unit, color }: { label: string; value: string | null; unit: string; color: string }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>{label}</div>
      <div className="font-bold text-lg" style={{ color }}>{value ?? "—"}</div>
      <div className="text-xs" style={{ color: "var(--text-dim)" }}>{unit}</div>
    </div>
  );
}

interface StravaWorkout {
  id: number;
  stravaId: string | null;
  date: string;
  name: string;
  sportType: string;
  durationSecs: number;
  distanceMeters: number | null;
  elevationGain: number | null;
  avgHeartrate: number | null;
  calories: number | null;
}

interface StravaStatus {
  connected: boolean;
  athleteName?: string;
  athletePhoto?: string;
  lastSync?: string;
  workouts?: StravaWorkout[];
}

const SPORT_EMOJI: Record<string, string> = {
  Run: "🏃", Ride: "🚴", Swim: "🏊", Walk: "🚶", Hike: "🥾",
  WeightTraining: "🏋️", Yoga: "🧘", Workout: "💪", VirtualRide: "🚴",
  AlpineSki: "⛷️", Crossfit: "💪", Rowing: "🚣", Golf: "⛳",
};

export default function HealthSection({ days }: { days: number }) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [strava, setStrava] = useState<StravaStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  function reload() {
    setLoading(true);
    fetch(`/api/health/metrics?days=${days}`)
      .then((r) => r.json())
      .then((d) => { setMetrics(d); setLoading(false); });
    fetch("/api/health/ingest")
      .then((r) => r.json())
      .then((d) => setLastSync(d.lastSync ?? null));
    fetch("/api/strava/status")
      .then((r) => r.json())
      .then((d) => setStrava(d))
      .catch(() => {});
  }

  async function syncStrava() {
    setSyncing(true);
    await fetch("/api/strava/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: 30 }) });
    await fetch("/api/strava/status").then(r => r.json()).then(d => setStrava(d));
    setSyncing(false);
  }

  useEffect(() => { reload(); }, [days]);

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-2xl" style={{ background: "var(--surface)" }} />)}
      </div>
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl" style={{ background: "var(--surface)" }} />)}
    </div>
  );
  if (!metrics.length) return <p className="text-sm" style={{ color: "var(--text-dim)" }}>No health data yet.</p>;

  const steps = groupByDate(metrics, "steps");
  const hrv = groupByDate(metrics, "hrv");
  const restingHr = groupByDate(metrics, "resting_hr");
  const sleep = groupByDate(metrics, "sleep_total");

  const daysSinceSync = lastSync
    ? Math.floor((Date.now() - new Date(lastSync).getTime()) / 86400000)
    : null;

  return (
    <div className="space-y-6">
      {/* Sync status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${daysSinceSync === 0 ? "bg-emerald-400" : daysSinceSync !== null && daysSinceSync <= 1 ? "bg-yellow-400" : "bg-red-400"}`} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {lastSync
              ? format(new Date(lastSync), "d MMM · HH:mm")
              : "No sync data"}
          </span>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Avg steps" value={avg(steps)?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? null} unit="/ day" color="var(--c-positive)" />
        <StatCard label="Avg HRV" value={avg(hrv)?.toFixed(0) ?? null} unit="ms" color="var(--c-primary)" />
        <StatCard label="Resting HR" value={avg(restingHr)?.toFixed(0) ?? null} unit="bpm" color="var(--c-heart)" />
        <StatCard label="Avg sleep" value={avg(sleep)?.toFixed(1) ?? null} unit="hr" color="var(--c-secondary)" />
      </div>

      {/* Steps */}
      <div>
        <h3 className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>Steps</h3>
        <MiniChart data={steps} color="#10b981" unit="steps" formatter={(v) => (v / 1000).toFixed(1) + "k"} gradientId="steps-grad" days={days} />
      </div>

      {/* HRV */}
      <div>
        <h3 className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>HRV</h3>
        <MiniChart data={hrv} color="#6366f1" unit="ms" gradientId="hrv-grad" days={days} />
      </div>

      {/* Resting HR */}
      <div>
        <h3 className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>Resting Heart Rate</h3>
        <MiniChart data={restingHr} color="#ec4899" unit="bpm" gradientId="hr-grad" days={days} />
      </div>

      {/* Sleep */}
      <div>
        <h3 className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>Sleep · Deep / REM / Core</h3>
        <SleepBar data={sleep} days={days} />
      </div>

      {/* Strava workouts */}
      <div style={{ borderTop: "1px solid var(--divider)", paddingTop: "1.25rem" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            🧡 Strava Workouts
          </h3>
          {strava?.connected ? (
            <div className="flex items-center gap-2">
              {strava.athleteName && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{strava.athleteName}</span>
              )}
              <button
                onClick={syncStrava}
                disabled={syncing}
                className="text-xs px-2.5 py-1 rounded-lg transition-all disabled:opacity-40"
                style={{ background: "var(--c-primary-dim)", color: "var(--c-primary)", border: "1px solid var(--c-primary-border)" }}
              >
                {syncing ? "Syncing…" : "↻ Sync"}
              </button>
            </div>
          ) : (
            <a
              href="/api/strava/auth"
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
              style={{ background: "rgba(252,76,2,0.15)", color: "#fc4c02", border: "1px solid rgba(252,76,2,0.3)" }}
            >
              Connect Strava
            </a>
          )}
        </div>

        {strava?.connected && strava.workouts?.length ? (
          <div className="space-y-0">
            {strava.workouts.map((w, i) => {
              const mins = Math.round(w.durationSecs / 60);
              const km = w.distanceMeters ? (w.distanceMeters / 1000).toFixed(1) : null;
              const emoji = SPORT_EMOJI[w.sportType] ?? "💪";
              const stravaUrl = w.stravaId ? `https://www.strava.com/activities/${w.stravaId}` : null;
              const stats = [
                format(parseISO(w.date), "MMM d"),
                `${mins} min`,
                km ? `${km} km` : null,
                w.avgHeartrate ? `${Math.round(w.avgHeartrate)} bpm` : null,
                w.elevationGain && w.elevationGain > 0 ? `↑${Math.round(w.elevationGain)}m` : null,
                w.calories ? `${Math.round(w.calories)} kcal` : null,
              ].filter(Boolean).join(" · ");
              const inner = (
                <>
                  <span className="text-lg flex-shrink-0">{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{w.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{stats}</p>
                  </div>
                  {stravaUrl && <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-dim)" }}>↗</span>}
                </>
              );
              const cls = `flex items-center gap-3 py-2.5 transition-opacity ${i < strava.workouts!.length - 1 ? "border-b" : ""}`;
              return stravaUrl ? (
                <a key={w.id} href={stravaUrl} target="_blank" rel="noopener noreferrer"
                  className={cls + " hover:opacity-70"}
                  style={{ borderColor: "var(--divider)" }}>
                  {inner}
                </a>
              ) : (
                <div key={w.id} className={cls} style={{ borderColor: "var(--divider)" }}>{inner}</div>
              );
            })}
          </div>
        ) : strava?.connected ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>No recent workouts — tap Sync to load.</p>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Connect your Strava account to see workouts here.</p>
        )}
      </div>
    </div>
  );
}
