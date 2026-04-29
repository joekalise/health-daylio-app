import { NextResponse } from "next/server";

export const maxDuration = 60;
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { moodEntries, healthMetrics, financeEntries, financeSnapshots, financeBalances, financeAccounts } from "@/db/schema";
import { desc, eq, gte, asc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const cut90 = new Date(today); cut90.setDate(cut90.getDate() - 90);
  const cut30 = new Date(today); cut30.setDate(cut30.getDate() - 30);
  const cut90s = cut90.toISOString().split("T")[0];
  const cut30s = cut30.toISOString().split("T")[0];
  const todayS = today.toISOString().split("T")[0];

  // Only fetch last 90 days of moods — no need for all-time
  const [moods, health, snapshot, accounts] = await Promise.all([
    db.select().from(moodEntries).where(gte(moodEntries.date, cut90s)).orderBy(desc(moodEntries.date)),
    db.select().from(healthMetrics).where(gte(healthMetrics.date, cut90s)).orderBy(desc(healthMetrics.date)),
    db.select().from(financeSnapshots).orderBy(desc(financeSnapshots.importedAt)).limit(1),
    db.select().from(financeAccounts).where(eq(financeAccounts.isActive, true)),
  ]);

  const recent30Moods = moods.filter(m => m.date >= cut30s);
  const prev30Moods = moods.filter(m => m.date < cut30s);

  const avg = (arr: typeof moods) => arr.length ? arr.reduce((s, m) => s + m.moodScore, 0) / arr.length : null;
  const recent30Avg = avg(recent30Moods);
  const prev30Avg = avg(prev30Moods);

  const actMap: Record<string, { total: number; count: number }> = {};
  for (const m of moods) {
    for (const a of (m.activities ?? [])) {
      if (!actMap[a]) actMap[a] = { total: 0, count: 0 };
      actMap[a].total += m.moodScore;
      actMap[a].count++;
    }
  }
  const activityStats = Object.entries(actMap)
    .filter(([, v]) => v.count >= 3)
    .map(([name, v]) => ({ name, avg: +(v.total / v.count).toFixed(2), count: v.count }))
    .sort((a, b) => b.avg - a.avg);

  const healthByType: Record<string, number[]> = {};
  for (const h of health) {
    if (!healthByType[h.type]) healthByType[h.type] = [];
    healthByType[h.type].push(h.value);
  }
  const healthAvgs: Record<string, string> = {};
  for (const [t, vals] of Object.entries(healthByType)) {
    healthAvgs[t] = (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1);
  }

  const dowMap: Record<number, { total: number; count: number }> = {};
  for (const m of moods) {
    const dow = new Date(m.date + "T00:00:00").getDay();
    if (!dowMap[dow]) dowMap[dow] = { total: 0, count: 0 };
    dowMap[dow].total += m.moodScore;
    dowMap[dow].count++;
  }
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const dowStats = Object.entries(dowMap).map(([d, v]) => ({ day: DAYS[Number(d)], avg: +(v.total / v.count).toFixed(2) })).sort((a, b) => b.avg - a.avg);

  const dist: Record<string, number> = {};
  for (const m of moods) dist[m.mood] = (dist[m.mood] ?? 0) + 1;

  const recentNotes = moods.slice(0, 20).filter(m => m.note && m.note.length > 10).slice(0, 5).map(m => ({
    date: m.date, mood: m.mood, note: m.note?.slice(0, 150),
  }));

  let budgetEntries: { name: string; value: number; category: string }[] = [];
  let netWorthLatest: number | null = null;
  if (snapshot.length) {
    const entries = await db.select().from(financeEntries).where(eq(financeEntries.snapshotId, snapshot[0].id));
    budgetEntries = entries.map(e => ({ name: e.name, value: e.value, category: e.category }));
    const balances = await db.select().from(financeBalances).orderBy(desc(financeBalances.date));
    const netWorthIds = new Set(accounts.filter(a => a.isNetWorth).map(a => a.id));
    const latestByAccount: Record<number, number> = {};
    for (const b of balances) { if (!(b.accountId in latestByAccount)) latestByAccount[b.accountId] = b.amount; }
    netWorthLatest = Object.entries(latestByAccount).filter(([id]) => netWorthIds.has(Number(id))).reduce((s, [, v]) => s + v, 0);
  }

  const income = budgetEntries.filter(e => e.category === "income").reduce((s, e) => s + e.value, 0);

  const context = {
    today: todayS,
    mood: {
      last90DaysEntries: moods.length,
      recent30Avg: recent30Avg?.toFixed(2),
      prev30Avg: prev30Avg?.toFixed(2),
      trend: recent30Avg && prev30Avg ? (recent30Avg - prev30Avg).toFixed(2) : null,
      distribution: dist,
      topActivitiesByMood: activityStats.slice(0, 8),
      worstActivities: [...activityStats].sort((a, b) => a.avg - b.avg).slice(0, 4),
      bestDay: dowStats[0],
      worstDay: dowStats[dowStats.length - 1],
      recentNotes,
    },
    health: {
      averages: healthAvgs,
      dataPoints: Object.fromEntries(Object.entries(healthByType).map(([k, v]) => [k, v.length])),
    },
    finance: {
      netWorth: netWorthLatest ? Math.round(netWorthLatest) : null,
      monthlyIncome: Math.round(income),
    },
  };

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: `You are a personal analytics assistant for someone with Ankylosing Spondylitis (AS). Generate specific, actionable insights from their life data. Reference actual numbers. Look for AS flare precursors (declining mood + poor sleep + no exercise). Cross-domain patterns are valuable.

Return ONLY valid JSON (no markdown, no code fences):
{"summary":"2-sentence honest assessment","insights":[{"title":"4-6 word title","body":"2-3 sentences with specific numbers and what to do","category":"mood|health|finance|pattern","sentiment":"positive|neutral|negative"}]}

Generate 4-5 insights.`,
      messages: [{ role: "user", content: JSON.stringify(context) }],
    });

    const raw = response.content.find(b => b.type === "text")?.text ?? "{}";
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({ ...parsed, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[insights] Claude error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Claude call failed" },
      { status: 500 }
    );
  }
}
