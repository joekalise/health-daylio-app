import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { moodEntries } from "@/db/schema";
import { desc } from "drizzle-orm";
import { sendToAll } from "@/lib/push";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];
  const [latest] = await db.select().from(moodEntries).orderBy(desc(moodEntries.date)).limit(1);

  if (latest?.date === today) {
    return NextResponse.json({ skipped: true, reason: "already logged today" });
  }

  await sendToAll({
    title: "How are you feeling?",
    body: "You haven't logged your mood today yet. Tap to log now.",
    url: "/dashboard",
    tag: "mood-reminder",
  });

  return NextResponse.json({ ok: true });
}
