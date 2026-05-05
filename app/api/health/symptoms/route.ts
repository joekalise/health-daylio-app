import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { healthMetrics } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const today = new Date().toISOString().split("T")[0];
  const [row] = await db.select().from(healthMetrics).where(
    and(eq(healthMetrics.date, today), eq(healthMetrics.type, "symptoms"))
  ).limit(1);

  return NextResponse.json({ symptoms: row?.value ?? null });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { symptoms, date } = await req.json();
  if (symptoms == null || typeof symptoms !== "number") {
    return NextResponse.json({ error: "symptoms required" }, { status: 400 });
  }

  const today = date ?? new Date().toISOString().split("T")[0];
  await db.insert(healthMetrics)
    .values({ date: today, type: "symptoms", value: symptoms, unit: "scale", source: "manual" })
    .onConflictDoUpdate({
      target: [healthMetrics.date, healthMetrics.type],
      set: { value: sql`excluded.value`, createdAt: sql`now()` },
    });

  return NextResponse.json({ ok: true });
}
