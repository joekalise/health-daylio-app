import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { moodEntries } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.execute(sql`SELECT DISTINCT unnest(activities) as activity FROM mood_entries ORDER BY activity`);
  const activities = (rows as unknown as { rows: { activity: string }[] }).rows.map((r) => r.activity).filter(Boolean);
  return NextResponse.json(activities);
}
