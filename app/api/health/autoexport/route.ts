import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { healthMetrics } from "@/db/schema";
import { auth } from "@/lib/auth";
import { sql } from "drizzle-orm";

// Maps Auto Export metric names to our internal types
const METRIC_MAP: Record<string, string> = {
  step_count: "steps",
  resting_heart_rate: "resting_hr",
  heart_rate_variability: "hrv",
  walking_running_distance: "walking_distance",
  active_energy: "active_energy",
  body_mass: "weight",
  weight: "weight",
  body_fat_percentage: "body_fat",
  vo2_max: "vo2max",
  respiratory_rate: "respiratory_rate",
  apple_sleeping_wrist_temperature: "wrist_temp",
};

const UNITS_MAP: Record<string, string> = {
  steps: "count",
  resting_hr: "bpm",
  hrv: "ms",
  walking_distance: "km",
  active_energy: "kcal",
  weight: "kg",
  body_fat: "%",
  vo2max: "mL/kg/min",
  respiratory_rate: "bpm",
  wrist_temp: "°C",
};

function parseDate(dateStr: string): string {
  // "2026-04-28 00:00:00 +0200" → "2026-04-28"
  return dateStr.slice(0, 10);
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  const session = await auth();
  if (apiKey !== process.env.INGEST_API_KEY && !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const metrics: { name: string; units: string; data: Record<string, unknown>[] }[] = body?.data?.metrics ?? [];

  if (!metrics.length) return NextResponse.json({ error: "No metrics found" }, { status: 400 });

  const rows: typeof healthMetrics.$inferInsert[] = [];

  for (const metric of metrics) {
    const { name, data } = metric;

    // Sleep is special — nested fields
    if (name === "sleep_analysis") {
      for (const entry of data) {
        const date = parseDate(entry.date as string);
        const totalSleep = entry.totalSleep as number | null;
        const deep = entry.deep as number | null;
        const rem = entry.rem as number | null;
        const core = entry.core as number | null;

        if (totalSleep != null && totalSleep > 0) {
          rows.push({
            date,
            type: "sleep_total",
            value: totalSleep,
            unit: "hr",
            source: "apple_health",
            metadata: { deep: deep ?? null, rem: rem ?? null, core: core ?? null },
          });
        }
      }
      continue;
    }

    const internalType = METRIC_MAP[name];
    if (!internalType) continue;

    for (const entry of data) {
      const date = parseDate(entry.date as string);
      let qty = entry.qty as number;
      if (qty == null || isNaN(qty)) continue;

      // Convert kJ → kcal for active energy
      if (name === "active_energy") qty = qty / 4.184;

      rows.push({
        date,
        type: internalType,
        value: qty,
        unit: UNITS_MAP[internalType] ?? null,
        source: "apple_health",
        metadata: null,
      });
    }
  }

  if (!rows.length) return NextResponse.json({ ok: true, upserted: 0 });

  await db.insert(healthMetrics)
    .values(rows)
    .onConflictDoUpdate({
      target: [healthMetrics.date, healthMetrics.type],
      set: {
        value: sql`excluded.value`,
        metadata: sql`excluded.metadata`,
        createdAt: sql`now()`,
      },
    });

  return NextResponse.json({ ok: true, upserted: rows.length });
}
