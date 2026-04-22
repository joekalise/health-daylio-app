import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { financeEntries, financeSnapshots } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// Update individual entry values
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const updates: { id: number; value: number }[] = await req.json();
  for (const { id, value } of updates) {
    await db.update(financeEntries).set({ value }).where(eq(financeEntries.id, id));
  }
  return NextResponse.json({ ok: true, updated: updates.length });
}

// Add a new entry to the latest snapshot
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Get or create a manual snapshot
  let [latest] = await db.select().from(financeSnapshots).orderBy(desc(financeSnapshots.importedAt)).limit(1);
  if (!latest) {
    [latest] = await db.insert(financeSnapshots).values({ source: "manual" }).returning();
  }

  const [entry] = await db.insert(financeEntries).values({
    snapshotId: latest.id,
    category: body.category ?? "expense",
    name: body.name,
    value: body.value,
    metadata: body.metadata ?? null,
  }).returning();

  return NextResponse.json(entry);
}

// Delete an entry
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await db.delete(financeEntries).where(eq(financeEntries.id, id));
  return NextResponse.json({ ok: true });
}
