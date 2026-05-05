import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { chatMessages } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const messages = await db.select().from(chatMessages).orderBy(asc(chatMessages.createdAt));
  return NextResponse.json(messages.map(m => ({ role: m.role, content: m.content })));
}

export async function DELETE() {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  await db.delete(chatMessages);
  return NextResponse.json({ ok: true });
}
