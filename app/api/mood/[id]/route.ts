import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { moodEntries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { MOOD_SCORES } from "@/lib/mood";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const [entry] = await db.select().from(moodEntries).where(eq(moodEntries.id, Number(id)));
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entry);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { mood, activities, note } = await req.json() as { mood: string; activities: string[]; note: string };
  const moodScore = MOOD_SCORES[mood];
  if (!moodScore) return NextResponse.json({ error: "Invalid mood" }, { status: 400 });
  const [updated] = await db.update(moodEntries)
    .set({ mood, moodScore, activities, note: note || null })
    .where(eq(moodEntries.id, Number(id)))
    .returning();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}
