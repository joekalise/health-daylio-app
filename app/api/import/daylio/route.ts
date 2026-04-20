import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { moodEntries } from "@/db/schema";
import { MOOD_SCORES } from "@/lib/mood";
import Papa from "papaparse";

interface DaylioRow {
  full_date: string;
  time: string;
  mood: string;
  activities: string;
  note_title: string;
  note: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const text = await req.text();
  const { data } = Papa.parse<DaylioRow>(text, { header: true, skipEmptyLines: true });

  const rows = data.map((row) => ({
    date: row.full_date,
    time: row.time || null,
    mood: row.mood.trim().toLowerCase(),
    moodScore: MOOD_SCORES[row.mood.trim().toLowerCase()] ?? 3,
    activities: row.activities
      ? row.activities.split("|").map((a) => a.trim()).filter(Boolean)
      : [],
    noteTitle: row.note_title || null,
    note: row.note || null,
    source: "daylio_import" as const,
  }));

  // Upsert by date+time to avoid duplicates on re-import
  await db.insert(moodEntries).values(rows).onConflictDoNothing();

  return NextResponse.json({ imported: rows.length });
}
