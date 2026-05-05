import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { moodEntries, healthMetrics } from "@/db/schema";
import { desc, gte, eq, and } from "drizzle-orm";
import { sendToAll } from "@/lib/push";
import { subDays } from "date-fns";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const d = (n: number) => subDays(now, n).toISOString().split("T")[0];

  const entries = await db.select().from(moodEntries).orderBy(desc(moodEntries.date)).limit(90);
  if (entries.length < 7) return NextResponse.json({ skipped: true, reason: "not enough data" });

  const [painRows, stiffnessRows] = await Promise.all([
    db.select().from(healthMetrics).where(and(gte(healthMetrics.date, d(5)), eq(healthMetrics.type, "pain"))),
    db.select().from(healthMetrics).where(and(gte(healthMetrics.date, d(5)), eq(healthMetrics.type, "stiffness"))),
  ]);

  const last5 = entries.filter(e => e.date >= d(5));
  const last7 = entries.filter(e => e.date >= d(7));
  const baseline = entries.filter(e => e.date >= d(90));

  const avg = (arr: typeof entries) => arr.length ? arr.reduce((s, e) => s + e.moodScore, 0) / arr.length : null;
  const hasActivity = (arr: typeof entries, act: string) => arr.some(e => e.activities?.includes(act));

  const baselineAvg = avg(baseline) ?? 3.5;
  const recent5Avg = avg(last5);

  const reasons: string[] = [];
  if (hasActivity(last7, "sick")) reasons.push("illness logged");
  // 2 nights in 5 days catches the sleep deterioration ~2 days before a flare
  const badSleep = last5.filter(e => e.activities?.some(a => ["bad sleep", "medium sleep"].includes(a)));
  if (badSleep.length >= 2) reasons.push(`${badSleep.length} nights poor sleep`);
  // Widened window and lower threshold to detect mood dip earlier
  if (recent5Avg !== null && recent5Avg < baselineAvg - 0.5) reasons.push("mood dipping below your normal");
  if (hasActivity(last7, "anxiety attack")) reasons.push("anxiety logged this week");

  const metricAvg = (rows: { value: number }[]) => rows.length ? rows.reduce((s, r) => s + r.value, 0) / rows.length : null;
  const avgPain = metricAvg(painRows.filter(r => r.date >= d(3)));
  const avgStiffness = metricAvg(stiffnessRows.filter(r => r.date >= d(3)));
  if (avgPain !== null && avgPain >= 5) reasons.push(`pain averaging ${avgPain.toFixed(1)}/10`);
  if (avgStiffness !== null && avgStiffness >= 6) reasons.push(`stiffness averaging ${avgStiffness.toFixed(1)}/10`);

  if (reasons.length === 0) return NextResponse.json({ ok: true, flare: false });

  const isHigh = reasons.length >= 3;
  await sendToAll({
    title: isHigh ? "⚠️ AS flare risk: High" : "⚠️ AS flare warning",
    body: reasons.slice(0, 2).join(", ") + ". Open the app to see details.",
    url: "/dashboard",
    tag: "flare-warning",
  });

  return NextResponse.json({ ok: true, flare: true, reasons });
}
