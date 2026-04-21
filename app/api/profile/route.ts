import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { userProfile } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [profile] = await db.select().from(userProfile).orderBy(desc(userProfile.updatedAt)).limit(1);
  return NextResponse.json(profile ?? null);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await req.json();
  const [existing] = await db.select().from(userProfile).limit(1);
  if (existing) {
    const [updated] = await db.update(userProfile).set({ ...data, updatedAt: new Date() }).returning();
    return NextResponse.json(updated);
  }
  const [created] = await db.insert(userProfile).values(data).returning();
  return NextResponse.json(created);
}
