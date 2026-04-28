import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { moodEntries, healthMetrics, userProfile, financeBalances, financeAccounts, financeEntries, financeSnapshots } from "@/db/schema";
import { gte, lte, and, desc, eq, asc } from "drizzle-orm";

const client = new Anthropic();

const TOOLS: Anthropic.Tool[] = [
  {
    name: "query_mood",
    description: "Query mood entries by date range. Returns mood scores, activities, and notes.",
    input_schema: {
      type: "object" as const,
      properties: {
        from_date: { type: "string", description: "Start date YYYY-MM-DD (optional)" },
        to_date: { type: "string", description: "End date YYYY-MM-DD (optional)" },
        limit: { type: "number", description: "Max entries to return (default 90, max 365)" },
      },
    },
  },
  {
    name: "query_health",
    description: "Query health metrics. Types: steps, hrv, resting_hr, active_energy, sleep_total, workout, walking_distance, vo2max, weight, spo2.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", description: "Metric type (e.g. steps, hrv, sleep_total, workout)" },
        from_date: { type: "string", description: "Start date YYYY-MM-DD (optional)" },
        to_date: { type: "string", description: "End date YYYY-MM-DD (optional)" },
        limit: { type: "number", description: "Max rows to return (default 90)" },
      },
      required: ["type"],
    },
  },
  {
    name: "get_activity_stats",
    description: "Get average mood score per activity, sorted best to worst. Useful for 'what activities correlate with good mood?'",
    input_schema: {
      type: "object" as const,
      properties: {
        min_count: { type: "number", description: "Minimum times activity must appear (default 3)" },
      },
    },
  },
  {
    name: "query_finance_balances",
    description: "Get net worth history over time, current account balances, and a breakdown of each account (name, type, current amount). Use this for net worth, savings, investment, or account balance questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        months: { type: "number", description: "How many months of net worth history to return (default 12, max 60)" },
      },
    },
  },
  {
    name: "query_finance_budget",
    description: "Get the user's monthly budget: income, expenses, and savings/investment allocations. Returns each line item with name, category, value, and type (I=income, E=expense, S=savings).",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

async function runTool(name: string, input: Record<string, unknown>) {
  if (name === "query_mood") {
    const limit = Math.min(Number(input.limit ?? 90), 365);
    const conditions = [];
    if (input.from_date) conditions.push(gte(moodEntries.date, input.from_date as string));
    if (input.to_date) conditions.push(lte(moodEntries.date, input.to_date as string));
    const rows = await db.select().from(moodEntries)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(moodEntries.date))
      .limit(limit);
    return JSON.stringify(rows.map(r => ({
      date: r.date, mood: r.mood, score: r.moodScore,
      activities: r.activities, note: r.note,
    })));
  }

  if (name === "query_health") {
    const limit = Math.min(Number(input.limit ?? 90), 365);
    const conditions = [eq(healthMetrics.type, input.type as string)];
    if (input.from_date) conditions.push(gte(healthMetrics.date, input.from_date as string));
    if (input.to_date) conditions.push(lte(healthMetrics.date, input.to_date as string));
    const rows = await db.select().from(healthMetrics)
      .where(and(...conditions))
      .orderBy(desc(healthMetrics.date))
      .limit(limit);
    return JSON.stringify(rows.map(r => ({
      date: r.date, value: r.value, unit: r.unit, metadata: r.metadata,
    })));
  }

  if (name === "get_activity_stats") {
    const minCount = Number(input.min_count ?? 3);
    const all = await db.select({
      activities: moodEntries.activities,
      moodScore: moodEntries.moodScore,
    }).from(moodEntries);

    const stats: Record<string, { total: number; count: number }> = {};
    for (const row of all) {
      for (const act of (row.activities ?? [])) {
        if (!stats[act]) stats[act] = { total: 0, count: 0 };
        stats[act].total += row.moodScore;
        stats[act].count += 1;
      }
    }
    return JSON.stringify(
      Object.entries(stats)
        .filter(([, v]) => v.count >= minCount)
        .map(([name, v]) => ({ activity: name, avg_mood: +(v.total / v.count).toFixed(2), count: v.count }))
        .sort((a, b) => b.avg_mood - a.avg_mood)
    );
  }

  if (name === "query_finance_balances") {
    const months = Math.min(Number(input.months ?? 12), 60);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const accounts = await db.select().from(financeAccounts).where(eq(financeAccounts.isActive, true)).orderBy(asc(financeAccounts.displayOrder));
    const balances = await db.select().from(financeBalances).where(gte(financeBalances.date, cutoffStr)).orderBy(desc(financeBalances.date));

    const netWorthIds = new Set(accounts.filter(a => a.isNetWorth).map(a => a.id));

    // Latest balance per account
    const latestByAccount: Record<number, number> = {};
    for (const b of balances) {
      if (!(b.accountId in latestByAccount)) latestByAccount[b.accountId] = b.amount;
    }

    // Net worth history by date
    const byDate: Record<string, number> = {};
    for (const b of balances) {
      if (!netWorthIds.has(b.accountId)) continue;
      byDate[b.date] = (byDate[b.date] ?? 0) + b.amount;
    }
    const history = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, netWorth]) => ({ date, netWorth }));

    const accountSummary = accounts.map(a => ({
      name: a.name,
      type: a.type,
      currency: a.currency,
      isNetWorth: a.isNetWorth,
      currentBalance: latestByAccount[a.id] ?? null,
    }));

    return JSON.stringify({ accounts: accountSummary, netWorthHistory: history });
  }

  if (name === "query_finance_budget") {
    const [snapshot] = await db.select().from(financeSnapshots).orderBy(desc(financeSnapshots.importedAt)).limit(1);
    if (!snapshot) return JSON.stringify({ entries: [] });

    const entries = await db.select().from(financeEntries).where(eq(financeEntries.snapshotId, snapshot.id));
    return JSON.stringify({
      entries: entries.map(e => ({
        name: e.name,
        category: e.category,
        value: e.value,
        currency: e.currency,
        type: (e.metadata as { type?: string } | null)?.type ?? null,
      })),
    });
  }

  return "Unknown tool";
}

async function buildSystem(): Promise<string> {
  const [profile] = await db.select().from(userProfile).limit(1);
  const today = new Date().toISOString().split("T")[0];

  let profileSection = "";
  if (profile) {
    const parts: string[] = [];
    if (profile.name) parts.push(`Name: ${profile.name}`);
    if (profile.age) parts.push(`Age: ${profile.age}`);
    if (profile.occupation) parts.push(`Occupation: ${profile.occupation}`);
    if (profile.location) parts.push(`Location: ${profile.location}`);
    if (profile.healthConditions) parts.push(`Health conditions: ${profile.healthConditions}`);
    if (profile.medications) parts.push(`Medications/supplements: ${profile.medications}`);
    if (profile.fitnessGoals) parts.push(`Fitness goals: ${profile.fitnessGoals}`);
    if (profile.financialGoals) parts.push(`Financial goals: ${profile.financialGoals}`);
    if (profile.about) parts.push(`About: ${profile.about}`);
    if (parts.length) profileSection = `\n\nUser profile:\n${parts.join("\n")}`;
  }

  return `You are a personal analytics assistant for a specific user's life dashboard. You have access to their Apple Health data, mood tracking, and financial data.

Available data:
- Mood entries: daily mood (rad/good/meh/bad/awful), activities, notes — going back years
- Health metrics: steps, HRV, resting heart rate, sleep, workouts, active energy, weight
- Finance: net worth history, account balances (Revolut, Emergency Fund, investments, pension, flat equity), monthly budget (income, expenses, savings allocations)${profileSection}

Use the tools to look up real data before answering. Be conversational, insightful, and specific — reference actual numbers and dates. Factor in the user's health conditions and goals when giving insights. Spot patterns across all domains (e.g. mood vs exercise, savings rate trends, net worth growth). Today's date is ${today}.`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { messages } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: data })}\n\n`));
      const done = () => { controller.enqueue(encoder.encode("data: [DONE]\n\n")); controller.close(); };

      try {
        let apiMessages: Anthropic.MessageParam[] = messages;
        const system = await buildSystem();

        // Agentic loop — Claude may call tools multiple times
        while (true) {
          const response = await client.messages.create({
            model: "claude-opus-4-7",
            max_tokens: 4096,
            thinking: { type: "adaptive" },
            system,
            tools: TOOLS,
            messages: apiMessages,
          });

          // Stream text blocks
          for (const block of response.content) {
            if (block.type === "text") send(block.text);
          }

          if (response.stop_reason === "end_turn") break;

          if (response.stop_reason === "tool_use") {
            apiMessages = [...apiMessages, { role: "assistant", content: response.content }];

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of response.content) {
              if (block.type === "tool_use") {
                const result = await runTool(block.name, block.input as Record<string, unknown>);
                toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
              }
            }
            apiMessages = [...apiMessages, { role: "user", content: toolResults }];
            continue;
          }

          break;
        }
      } catch (err) {
        send(`\n\nError: ${err instanceof Error ? err.message : "Unknown error"}`);
      }

      done();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
