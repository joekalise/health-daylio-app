import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { stravaTokens, workouts } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [token] = await db.select().from(stravaTokens).limit(1);
  if (!token) return NextResponse.json({ connected: false });

  const recentWorkouts = await db.select().from(workouts)
    .orderBy(desc(workouts.date), desc(workouts.id))
    .limit(10);

  return NextResponse.json({
    connected: true,
    athleteName: token.athleteName,
    athletePhoto: token.athletePhoto,
    lastSync: token.updatedAt,
    workouts: recentWorkouts,
  });
}
