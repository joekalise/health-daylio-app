import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { moodEntries } from "@/db/schema";
import { desc, gte, lte, and } from "drizzle-orm";
import { MOOD_SCORES } from "@/lib/mood";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const conditions = [];
  if (from) conditions.push(gte(moodEntries.date, from));
  if (to) conditions.push(lte(moodEntries.date, to));

  const entries = await db
    .select()
    .from(moodEntries)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(moodEntries.date))
    .limit(500);

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { date, time, mood, activities, note } = body;

  const entry = await db
    .insert(moodEntries)
    .values({
      date,
      time: time || null,
      mood: mood.toLowerCase(),
      moodScore: MOOD_SCORES[mood.toLowerCase()] ?? 3,
      activities: activities ?? [],
      note: note || null,
      source: "manual",
    })
    .returning();

  return NextResponse.json(entry[0]);
}
