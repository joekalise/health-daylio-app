import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { healthMetrics } from "@/db/schema";
import { auth } from "@/lib/auth";
import { sql } from "drizzle-orm";

interface ShortcutsPayload {
  date: string; // YYYY-MM-DD
  steps?: number;
  resting_hr?: number;
  hrv?: number;
  active_energy?: number;
  walking_distance?: number;
  flights_climbed?: number;
  sleep_total?: number;
  sleep_deep?: number;
  sleep_rem?: number;
  sleep_core?: number;
  weight?: number;
  spo2?: number;
  vo2max?: number;
  respiratory_rate?: number;
}

const UNITS: Record<string, string> = {
  steps: "count",
  resting_hr: "bpm",
  hrv: "ms",
  active_energy: "kcal",
  walking_distance: "km",
  flights_climbed: "count",
  weight: "kg",
  spo2: "%",
  vo2max: "mL/kg/min",
  respiratory_rate: "bpm",
};

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  const session = await auth();
  if (apiKey !== process.env.INGEST_API_KEY && !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: ShortcutsPayload = await req.json();
  const { date, sleep_total, sleep_deep, sleep_rem, sleep_core, ...rest } = body;

  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const rows: typeof healthMetrics.$inferInsert[] = [];

  for (const [type, value] of Object.entries(rest)) {
    if (value == null || typeof value !== "number") continue;
    rows.push({ date, type, value, unit: UNITS[type] ?? null, metadata: null, source: "apple_health" });
  }

  if (sleep_total != null) {
    rows.push({
      date,
      type: "sleep_total",
      value: sleep_total,
      unit: "hr",
      source: "apple_health",
      metadata: { deep: sleep_deep ?? null, rem: sleep_rem ?? null, core: sleep_core ?? null },
    });
  }

  if (rows.length === 0) return NextResponse.json({ ok: true, upserted: 0 });

  // Upsert — update value + metadata if a record for (date, type) already exists
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

  return NextResponse.json({ ok: true, upserted: rows.length, date });
}

// Status endpoint — GET to check last sync time
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db.execute(
    sql`SELECT MAX(created_at) as last_synced_at FROM health_metrics WHERE source = 'apple_health'`
  );
  const raw = result.rows[0]?.last_synced_at as string | Date | null;
  // Neon returns TIMESTAMP WITHOUT TIME ZONE as a string with no 'Z', so JS parses it as
  // local time instead of UTC. Normalise to a proper UTC ISO string before sending.
  let lastSync: string | null = null;
  if (raw instanceof Date) {
    lastSync = raw.toISOString();
  } else if (typeof raw === "string") {
    lastSync = raw.includes("Z") || raw.includes("+") ? raw : raw.replace(" ", "T") + "Z";
  }
  return NextResponse.json({ lastSync });
}
