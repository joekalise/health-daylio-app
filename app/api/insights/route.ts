import { NextResponse } from "next/server";
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

  const [moods, health, snapshot, accounts] = await Promise.all([
    db.select().from(moodEntries).orderBy(desc(moodEntries.date)),
    db.select().from(healthMetrics).where(gte(healthMetrics.date, cut90s)).orderBy(desc(healthMetrics.date)),
    db.select().from(financeSnapshots).orderBy(desc(financeSnapshots.importedAt)).limit(1),
    db.select().from(financeAccounts).where(eq(financeAccounts.isActive, true)),
  ]);

  const recentMoods = moods.filter(m => m.date >= cut90s);
  const recent30Moods = moods.filter(m => m.date >= cut30s);
  const prev30Moods = moods.filter(m => m.date >= cut90s && m.date < cut30s);

  // Mood averages
  const avg = (arr: typeof moods) => arr.length ? arr.reduce((s, m) => s + m.moodScore, 0) / arr.length : null;
  const overallAvg = avg(moods);
  const recent30Avg = avg(recent30Moods);
  const prev30Avg = avg(prev30Moods);

  // Activity stats
  const actMap: Record<string, { total: number; count: number }> = {};
  for (const m of recentMoods) {
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

  // Health averages by type
  const healthByType: Record<string, number[]> = {};
  for (const h of health) {
    if (!healthByType[h.type]) healthByType[h.type] = [];
    healthByType[h.type].push(h.value);
  }
  const healthAvgs: Record<string, string> = {};
  for (const [t, vals] of Object.entries(healthByType)) {
    healthAvgs[t] = (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1);
  }

  // Day of week pattern
  const dowMap: Record<number, { total: number; count: number }> = {};
  for (const m of recentMoods) {
    const dow = new Date(m.date + "T00:00:00").getDay();
    if (!dowMap[dow]) dowMap[dow] = { total: 0, count: 0 };
    dowMap[dow].total += m.moodScore;
    dowMap[dow].count++;
  }
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const dowStats = Object.entries(dowMap).map(([d, v]) => ({ day: DAYS[Number(d)], avg: +(v.total / v.count).toFixed(2) })).sort((a, b) => b.avg - a.avg);

  // Mood distribution
  const dist: Record<string, number> = {};
  for (const m of recentMoods) dist[m.mood] = (dist[m.mood] ?? 0) + 1;

  // Recent notes (for qualitative context)
  const recentNotes = moods.slice(0, 20).filter(m => m.note && m.note.length > 10).slice(0, 5).map(m => ({
    date: m.date, mood: m.mood, note: m.note?.slice(0, 200),
  }));

  // Finance
  let budgetEntries: { name: string; value: number; type: string | null }[] = [];
  let netWorthLatest: number | null = null;
  if (snapshot) {
    const entries = await db.select().from(financeEntries).where(eq(financeEntries.snapshotId, snapshot[0]?.id ?? 0));
    budgetEntries = entries.map(e => ({ name: e.name, value: e.value, type: (e.metadata as { type?: string } | null)?.type ?? null }));
    const balances = await db.select().from(financeBalances).orderBy(desc(financeBalances.date));
    const netWorthIds = new Set(accounts.filter(a => a.isNetWorth).map(a => a.id));
    const latestByAccount: Record<number, number> = {};
    for (const b of balances) { if (!(b.accountId in latestByAccount)) latestByAccount[b.accountId] = b.amount; }
    netWorthLatest = Object.entries(latestByAccount).filter(([id]) => netWorthIds.has(Number(id))).reduce((s, [, v]) => s + v, 0);
  }

  const income = budgetEntries.filter(e => e.type === "I" || e.name.toLowerCase().includes("salary") || e.name.toLowerCase().includes("income")).reduce((s, e) => s + e.value, 0);
  const savings = budgetEntries.filter(e => e.type === "S").reduce((s, e) => s + e.value, 0);
  const expenses = budgetEntries.filter(e => !["I", "S"].includes(e.type ?? "")).reduce((s, e) => s + e.value, 0);

  const context = {
    today: todayS,
    mood: {
      totalEntries: moods.length,
      overallAvg: overallAvg?.toFixed(2),
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
      monthlyExpenses: Math.round(expenses),
      monthlySavings: Math.round(savings),
      savingsRate: income > 0 ? ((savings / income) * 100).toFixed(1) + "%" : null,
    },
  };

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: `You are a perceptive personal analytics assistant. Generate genuinely useful, specific insights from this user's life data. Be direct, concrete, and reference actual numbers. Surface non-obvious patterns. Look across mood, health, and finance for cross-domain insights (e.g. does exercise predict better mood? does financial stress show in mood?).

Return ONLY valid JSON in this exact structure:
{
  "summary": "2-sentence honest assessment of the user's current wellbeing trajectory",
  "insights": [
    {
      "title": "Punchy 4-6 word title",
      "body": "2-3 sentences. Specific numbers. What does this mean and what could they do about it?",
      "category": "mood|health|finance|pattern",
      "sentiment": "positive|neutral|negative"
    }
  ]
}

Generate 5-6 insights. Prioritise insights that are surprising, actionable, or cross-domain. Do not include markdown, code fences, or text outside the JSON object.`,
    messages: [{ role: "user", content: JSON.stringify(context, null, 2) }],
  });

  const raw = response.content.find(b => b.type === "text")?.text ?? "{}";
  try {
    const parsed = JSON.parse(raw);
    return NextResponse.json({ ...parsed, generatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "Parse failed", raw }, { status: 500 });
  }
}
