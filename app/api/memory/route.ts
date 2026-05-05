import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { claudeMemory } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const memories = await db.select().from(claudeMemory).orderBy(asc(claudeMemory.updatedAt));
  return NextResponse.json(memories);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { key } = await req.json();
  await db.delete(claudeMemory).where(eq(claudeMemory.key, key));
  return NextResponse.json({ ok: true });
}
