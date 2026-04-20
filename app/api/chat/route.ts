import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { moodEntries, healthMetrics } from "@/db/schema";
import { gte, lte, and, desc, eq } from "drizzle-orm";

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

  return "Unknown tool";
}

const SYSTEM = `You are a personal health and mood analytics assistant. You have access to the user's Apple Health data and mood tracking history (imported from Daylio).

Available data:
- Mood entries: daily mood (rad/good/meh/bad/awful), activities, notes — going back years
- Health metrics: steps, HRV, resting heart rate, sleep, workouts, active energy, VO2 max, weight

Use the tools to look up real data before answering. Be conversational, insightful, and specific — reference actual numbers and dates. Spot patterns (e.g. "your HRV is higher on days you log 'exercise'"). Today's date is ${new Date().toISOString().split("T")[0]}.`;

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

        // Agentic loop — Claude may call tools multiple times
        while (true) {
          const response = await client.messages.create({
            model: "claude-opus-4-7",
            max_tokens: 4096,
            thinking: { type: "adaptive" },
            system: SYSTEM,
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
