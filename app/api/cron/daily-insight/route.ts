import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { healthMetrics, moodEntries, claudeMemory } from "@/db/schema";
import { desc, gte, asc, eq } from "drizzle-orm";
import { sendToAll } from "@/lib/push";
import { subDays, format } from "date-fns";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const yesterday = subDays(now, 1).toISOString().split("T")[0];
  const thirtyDaysAgo = subDays(now, 30).toISOString().split("T")[0];

  const [yesterdayMetrics, recentMetrics, recentMood, memories] = await Promise.all([
    db.select().from(healthMetrics).where(eq(healthMetrics.date, yesterday)),
    db.select().from(healthMetrics).where(gte(healthMetrics.date, thirtyDaysAgo)),
    db.select().from(moodEntries).orderBy(desc(moodEntries.date)).limit(7),
    db.select().from(claudeMemory).orderBy(asc(claudeMemory.updatedAt)),
  ]);

  if (!yesterdayMetrics.length && !recentMood.length) {
    return NextResponse.json({ skipped: true, reason: "no data" });
  }

  // Yesterday's key metrics
  const yMap: Record<string, number> = {};
  for (const m of yesterdayMetrics) yMap[m.type] = m.value;

  // 30-day averages for comparison
  const avgMap: Record<string, { total: number; count: number }> = {};
  for (const m of recentMetrics) {
    if (!avgMap[m.type]) avgMap[m.type] = { total: 0, count: 0 };
    avgMap[m.type].total += m.value;
    avgMap[m.type].count++;
  }
  const avg30 = (type: string) => avgMap[type] ? avgMap[type].total / avgMap[type].count : null;

  const fmt = (val: number | undefined, digits = 0) =>
    val != null ? val.toFixed(digits) : null;

  const metricLines = [
    yMap.sleep_total != null ? `Sleep: ${fmt(yMap.sleep_total, 1)}hr (your avg ${fmt(avg30("sleep_total") ?? undefined, 1)}hr)` : null,
    yMap.hrv != null ? `HRV: ${fmt(yMap.hrv)}ms (your avg ${fmt(avg30("hrv") ?? undefined)}ms)` : null,
    yMap.resting_hr != null ? `Resting HR: ${fmt(yMap.resting_hr)}bpm (your avg ${fmt(avg30("resting_hr") ?? undefined)}bpm)` : null,
    yMap.steps != null ? `Steps: ${Math.round(yMap.steps).toLocaleString()} (your avg ${Math.round(avg30("steps") ?? 0).toLocaleString()})` : null,
    yMap.symptoms != null ? `AS symptoms: ${yMap.symptoms}/10` : null,
  ].filter(Boolean).join("\n");

  // Recent mood context
  const latestMood = recentMood[0];
  const moodAvg = recentMood.length
    ? (recentMood.reduce((s, e) => s + e.moodScore, 0) / recentMood.length).toFixed(1)
    : null;
  const moodLine = latestMood
    ? `Yesterday's mood: ${latestMood.mood} (${latestMood.moodScore}/5). 7-day avg: ${moodAvg}/5.`
    : "";
  const noteLine = latestMood?.note ? `Note: "${latestMood.note}"` : "";
  const activitiesLine = latestMood?.activities?.length
    ? `Activities: ${latestMood.activities.join(", ")}`
    : "";

  const memoryText = memories.length > 0
    ? memories.map(m => `- ${m.key}: ${m.value}`).join("\n")
    : "None yet.";

  const today = format(now, "EEEE d MMMM yyyy");

  const prompt = `You generate a short, personal morning insight for a push notification. Today is ${today}.

Yesterday's health data:
${metricLines || "No health metrics synced."}

${moodLine}
${activitiesLine}
${noteLine}

What you know about this user from past conversations:
${memoryText}

Write 1–2 sentences. Be specific — reference actual numbers vs the user's averages where interesting. Focus on what to expect or watch for today based on patterns. Don't start with "Good morning" or a greeting. Don't be generic.`;

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 120,
    messages: [{ role: "user", content: prompt }],
  });

  const insight = response.content[0].type === "text" ? response.content[0].text.trim() : null;
  if (!insight) return NextResponse.json({ skipped: true, reason: "empty response" });

  await sendToAll({
    title: "Morning insight",
    body: insight,
    url: "/dashboard",
    tag: "daily-insight",
  });

  return NextResponse.json({ ok: true, insight });
}
