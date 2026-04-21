import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { financeSnapshots, financeEntries } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [latest] = await db
    .select()
    .from(financeSnapshots)
    .orderBy(desc(financeSnapshots.importedAt))
    .limit(1);

  if (!latest) return NextResponse.json({ entries: [], importedAt: null });

  const entries = await db
    .select()
    .from(financeEntries)
    .where(eq(financeEntries.snapshotId, latest.id));

  return NextResponse.json({ entries, importedAt: latest.importedAt });
}
