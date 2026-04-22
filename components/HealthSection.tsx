"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { format, parseISO } from "date-fns";

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

const tooltipStyle = { backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 };
const tickStyle = { fill: "#71717a", fontSize: 11 };

function MiniChart({ data, color, unit, formatter }: {
  data: { date: string; value: number }[];
  color: string;
  unit: string;
  formatter?: (v: number) => string;
}) {
  if (!data.length) return <p className="text-zinc-500 text-xs">No data</p>;
  return (
    <ResponsiveContainer width="100%" height={100}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="date" tickFormatter={(d) => format(parseISO(d), "MMM d")} tick={tickStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={36} tickFormatter={formatter} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(d) => format(parseISO(d as string), "MMM d, yyyy")}
          formatter={(v) => [(formatter ? formatter(Number(v)) : Number(v).toFixed(1)) + " " + unit, ""]}
        />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SleepBar({ data }: { data: Metric[] }) {
  const chartData = data
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      date: r.date,
      total: r.value,
      deep: (r.metadata?.deep ?? 0),
      rem: (r.metadata?.rem ?? 0),
      core: (r.metadata?.core ?? 0),
    }));

  if (!chartData.length) return <p className="text-zinc-500 text-xs">No data</p>;

  return (
    <ResponsiveContainer width="100%" height={100}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="date" tickFormatter={(d) => format(parseISO(d), "MMM d")} tick={tickStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={36} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(d) => format(parseISO(d as string), "MMM d, yyyy")}
          formatter={(v) => [Number(v).toFixed(1) + " hr", ""]}
        />
        <Bar dataKey="deep" stackId="a" fill="#6366f1" name="Deep" />
        <Bar dataKey="rem" stackId="a" fill="#8b5cf6" name="REM" />
        <Bar dataKey="core" stackId="a" fill="#a78bfa" name="Core" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function StatCard({ label, value, unit, color }: { label: string; value: string | null; unit: string; color: string }) {
  return (
    <div className="bg-zinc-800 rounded-xl p-3 text-center">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="font-bold text-lg" style={{ color }}>{value ?? "—"}</div>
      <div className="text-xs text-zinc-500">{unit}</div>
    </div>
  );
}

function ManualEntry({ onSaved }: { onSaved: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [fields, setFields] = useState({ steps: "", hrv: "", resting_hr: "", sleep_total: "", sleep_deep: "", sleep_rem: "", weight: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function set(k: keyof typeof fields, v: string) { setFields(p => ({ ...p, [k]: v })); }

  async function save() {
    setSaving(true);
    const body: Record<string, unknown> = { date };
    for (const [k, v] of Object.entries(fields)) {
      const n = parseFloat(v);
      if (!isNaN(n) && v !== "") body[k] = n;
    }
    await fetch("/api/health/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    setSaved(true);
    setOpen(false);
    onSaved();
    setTimeout(() => setSaved(false), 2000);
  }

  const inputClass = "w-full glass rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none";

  return (
    <div className="mt-4 pt-4 border-t border-white/5">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        {open ? "Cancel" : saved ? "Saved ✓" : "+ Add / correct metrics"}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wide block mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["steps", "Steps"],
              ["hrv", "HRV (ms)"],
              ["resting_hr", "Resting HR (bpm)"],
              ["sleep_total", "Sleep total (hr)"],
              ["sleep_deep", "Sleep deep (hr)"],
              ["sleep_rem", "Sleep REM (hr)"],
              ["weight", "Weight (kg)"],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] text-zinc-500 block mb-1">{label}</label>
                <input type="number" step="any" placeholder="—" value={fields[key]} onChange={e => set(key, e.target.value)} className={inputClass} />
              </div>
            ))}
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            style={{ background: "rgba(99,102,241,0.3)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc" }}
          >
            {saving ? "Saving..." : "Save metrics"}
          </button>
          <p className="text-[10px] text-zinc-600">For bulk historical imports, run the CLI script with your Apple Health export XML.</p>
        </div>
      )}
    </div>
  );
}

export default function HealthSection({ days }: { days: number }) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);

  function reload() {
    setLoading(true);
    fetch(`/api/health/metrics?days=${days}`)
      .then((r) => r.json())
      .then((d) => { setMetrics(d); setLoading(false); });
  }

  useEffect(() => { reload(); }, [days]);

  if (loading) return <p className="text-zinc-500 text-sm">Loading health data...</p>;
  if (!metrics.length) return <p className="text-zinc-500 text-sm">No health data yet.</p>;

  const steps = groupByDate(metrics, "steps");
  const hrv = groupByDate(metrics, "hrv");
  const restingHr = groupByDate(metrics, "resting_hr");
  const sleep = groupByDate(metrics, "sleep_total");
  const workoutRows = groupByDate(metrics, "workout");

  const recentWorkouts = workoutRows.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Avg steps" value={avg(steps)?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? null} unit="/ day" color="#22c55e" />
        <StatCard label="Avg HRV" value={avg(hrv)?.toFixed(0) ?? null} unit="ms" color="#6366f1" />
        <StatCard label="Resting HR" value={avg(restingHr)?.toFixed(0) ?? null} unit="bpm" color="#f97316" />
        <StatCard label="Avg sleep" value={avg(sleep)?.toFixed(1) ?? null} unit="hr" color="#8b5cf6" />
      </div>

      {/* Steps */}
      <div>
        <h3 className="text-xs font-medium text-zinc-400 mb-2">Steps</h3>
        <MiniChart data={steps} color="#22c55e" unit="steps" formatter={(v) => (v / 1000).toFixed(1) + "k"} />
      </div>

      {/* HRV */}
      <div>
        <h3 className="text-xs font-medium text-zinc-400 mb-2">HRV</h3>
        <MiniChart data={hrv} color="#6366f1" unit="ms" />
      </div>

      {/* Resting HR */}
      <div>
        <h3 className="text-xs font-medium text-zinc-400 mb-2">Resting Heart Rate</h3>
        <MiniChart data={restingHr} color="#f97316" unit="bpm" />
      </div>

      {/* Sleep */}
      <div>
        <h3 className="text-xs font-medium text-zinc-400 mb-2">Sleep · Deep / REM / Core</h3>
        <SleepBar data={sleep} />
      </div>

      {/* Recent workouts */}
      {recentWorkouts.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-zinc-400 mb-2">Recent workouts</h3>
          <div className="space-y-1">
            {recentWorkouts.map((w) => {
              const mins = Math.round(w.value / 60);
              const name = (w.metadata as { name?: string })?.name ?? "Workout";
              return (
                <div key={w.id} className="flex justify-between text-sm py-1 border-b border-zinc-800">
                  <span className="text-zinc-300">{name}</span>
                  <span className="text-zinc-500">{format(parseISO(w.date), "MMM d")} · {mins} min</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-white/5 text-center">
        <p className="text-[10px] text-zinc-600">Missing data? Add metrics in <span className="text-indigo-400">Settings → Uploads</span></p>
      </div>
    </div>
  );
}
