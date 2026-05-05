import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { moodEntries, healthMetrics } from "@/db/schema";
import { gte, eq, and } from "drizzle-orm";
import { subDays } from "date-fns";

function pearson(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 6) return null;
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? null : +(num / denom).toFixed(3);
}

const METRIC_TYPES = ["hrv", "sleep_total", "steps", "symptoms"] as const;

export async function GET() {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const cutoff = subDays(new Date(), 180).toISOString().split("T")[0];

  const [moods, ...metricRows] = await Promise.all([
    db.select().from(moodEntries).where(gte(moodEntries.date, cutoff)),
    ...METRIC_TYPES.map(type =>
      db.select({ date: healthMetrics.date, value: healthMetrics.value })
        .from(healthMetrics)
        .where(and(eq(healthMetrics.type, type), gte(healthMetrics.date, cutoff)))
    ),
  ]);

  // Index by date
  const moodByDate: Record<string, number> = {};
  for (const m of moods) moodByDate[m.date] = m.moodScore;

  const metricsByDate: Record<string, Record<string, number>> = {};
  for (const [i, type] of METRIC_TYPES.entries()) {
    metricsByDate[type] = {};
    for (const r of metricRows[i]) metricsByDate[type][r.date] = r.value;
  }

  const METRICS = [
    { key: "mood", label: "Mood", data: moodByDate, higherIsBetter: true },
    { key: "hrv", label: "HRV", data: metricsByDate["hrv"], higherIsBetter: true },
    { key: "sleep", label: "Sleep", data: metricsByDate["sleep_total"], higherIsBetter: true },
    { key: "steps", label: "Steps", data: metricsByDate["steps"], higherIsBetter: true },
    { key: "symptoms", label: "Pain", data: metricsByDate["symptoms"], higherIsBetter: false },
  ];

  const dates = Object.keys(moodByDate).sort();

  // Pairwise Pearson — only include dates where both values present
  const matrix: Record<string, Record<string, number | null>> = {};
  const sampleCounts: Record<string, Record<string, number>> = {};

  for (const a of METRICS) {
    matrix[a.key] = {};
    sampleCounts[a.key] = {};
    for (const b of METRICS) {
      if (a.key === b.key) { matrix[a.key][b.key] = 1; sampleCounts[a.key][b.key] = 0; continue; }
      const ax: number[] = [], bx: number[] = [];
      for (const date of dates) {
        const va = a.data[date];
        const vb = b.data[date];
        if (va !== undefined && vb !== undefined) { ax.push(va); bx.push(vb); }
      }
      matrix[a.key][b.key] = pearson(ax, bx);
      sampleCounts[a.key][b.key] = ax.length;
    }
  }

  // Activity ↔ mood point-biserial correlation
  // Treat activity presence as 1, absence as 0
  const allActivities = new Set<string>();
  for (const e of moods) for (const a of e.activities ?? []) allActivities.add(a);

  const actCorrs: { name: string; r: number; count: number; avgWith: number; avgWithout: number }[] = [];

  for (const activity of allActivities) {
    const withAct: number[] = [], withoutAct: number[] = [];
    for (const e of moods) {
      if ((e.activities ?? []).includes(activity)) withAct.push(e.moodScore);
      else withoutAct.push(e.moodScore);
    }
    if (withAct.length < 7 || withoutAct.length < 7) continue;
    const x = [...withAct.map(() => 1), ...withoutAct.map(() => 0)];
    const y = [...withAct, ...withoutAct];
    const r = pearson(x, y);
    if (r === null) continue;
    const avgWith = withAct.reduce((s, v) => s + v, 0) / withAct.length;
    const avgWithout = withoutAct.reduce((s, v) => s + v, 0) / withoutAct.length;
    actCorrs.push({ name: activity, r, count: withAct.length, avgWith: +avgWith.toFixed(2), avgWithout: +avgWithout.toFixed(2) });
  }

  actCorrs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  return NextResponse.json({
    metrics: METRICS.map(m => ({ key: m.key, label: m.label, higherIsBetter: m.higherIsBetter })),
    matrix,
    sampleCounts,
    activityCorrs: actCorrs.slice(0, 12),
    totalDays: dates.length,
  });
}
