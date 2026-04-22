import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { healthMetrics } from "@/db/schema";
import { auth } from "@/lib/auth";

// Simple flat payload from iOS Shortcuts
interface ShortcutsPayload {
  date: string; // YYYY-MM-DD
  steps?: number;
  resting_hr?: number;
  hrv?: number;
  active_energy?: number;
  walking_distance?: number;
  flights_climbed?: number;
  sleep_total?: number;   // hours
  sleep_deep?: number;
  sleep_rem?: number;
  sleep_core?: number;
  weight?: number;
  spo2?: number;
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  const session = await auth();
  if (apiKey !== process.env.INGEST_API_KEY && !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: ShortcutsPayload = await req.json();
  const { date, sleep_total, sleep_deep, sleep_rem, sleep_core, ...rest } = body;

  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const UNITS: Record<string, string> = {
    steps: "count",
    resting_hr: "bpm",
    hrv: "ms",
    active_energy: "kcal",
    walking_distance: "km",
    flights_climbed: "count",
    weight: "kg",
    spo2: "%",
  };

  const inserts: {
    date: string;
    type: string;
    value: number;
    unit: string | null;
    metadata: Record<string, unknown> | null;
    source: string;
  }[] = [];

  // Flat metrics
  for (const [type, value] of Object.entries(rest)) {
    if (value == null || typeof value !== "number") continue;
    inserts.push({ date, type, value, unit: UNITS[type] ?? null, metadata: null, source: "apple_health" });
  }

  // Sleep as one combined row
  if (sleep_total != null) {
    inserts.push({
      date,
      type: "sleep_total",
      value: sleep_total,
      unit: "hr",
      source: "apple_health",
      metadata: { deep: sleep_deep ?? null, rem: sleep_rem ?? null, core: sleep_core ?? null },
    });
  }

  if (inserts.length === 0) return NextResponse.json({ inserted: 0 });

  await db.insert(healthMetrics).values(inserts).onConflictDoNothing();

  return NextResponse.json({ inserted: inserts.length });
}
