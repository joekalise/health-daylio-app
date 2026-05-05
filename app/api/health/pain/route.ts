import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { healthMetrics } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const today = new Date().toISOString().split("T")[0];
  const rows = await db.select().from(healthMetrics).where(
    and(eq(healthMetrics.date, today))
  );

  const pain = rows.find(r => r.type === "pain")?.value ?? null;
  const stiffness = rows.find(r => r.type === "stiffness")?.value ?? null;
  return NextResponse.json({ pain, stiffness });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { pain, stiffness, date } = await req.json();
  const today = date ?? new Date().toISOString().split("T")[0];

  const rows: typeof healthMetrics.$inferInsert[] = [];
  if (pain != null) rows.push({ date: today, type: "pain", value: pain, unit: "scale", source: "manual" });
  if (stiffness != null) rows.push({ date: today, type: "stiffness", value: stiffness, unit: "scale", source: "manual" });
  if (!rows.length) return NextResponse.json({ ok: true });

  await db.insert(healthMetrics).values(rows).onConflictDoUpdate({
    target: [healthMetrics.date, healthMetrics.type],
    set: { value: sql`excluded.value`, createdAt: sql`now()` },
  });

  return NextResponse.json({ ok: true });
}
