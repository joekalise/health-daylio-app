import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncStravaActivities } from "@/lib/strava";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { days = 30 } = await req.json().catch(() => ({}));

  try {
    const synced = await syncStravaActivities(Number(days));
    return NextResponse.json({ ok: true, synced });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}
