import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { financeAccounts } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const accounts = await db.select().from(financeAccounts).where(eq(financeAccounts.isActive, true)).orderBy(asc(financeAccounts.displayOrder));
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await req.json();
  const [account] = await db.insert(financeAccounts).values(data).returning();
  return NextResponse.json(account);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  await db.update(financeAccounts).set({ isActive: false }).where(eq(financeAccounts.id, id));
  return NextResponse.json({ ok: true });
}
