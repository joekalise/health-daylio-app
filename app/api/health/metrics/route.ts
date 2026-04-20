import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { healthMetrics } from "@/db/schema";
import { desc, gte, inArray } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? "90");
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fromStr = from.toISOString().split("T")[0];

  const types = ["steps", "hrv", "resting_hr", "active_energy", "sleep_total", "workout", "walking_distance", "vo2max"];

  const rows = await db
    .select()
    .from(healthMetrics)
    .where(gte(healthMetrics.date, fromStr))
    .orderBy(desc(healthMetrics.date))
    .limit(20000);

  return NextResponse.json(rows);
}
