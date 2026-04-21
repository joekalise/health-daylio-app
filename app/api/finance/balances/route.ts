import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { financeBalances, financeAccounts } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get all balances, ordered by date
  const balances = await db.select().from(financeBalances).orderBy(desc(financeBalances.date), asc(financeBalances.accountId));
  const accounts = await db.select().from(financeAccounts).where(eq(financeAccounts.isActive, true)).orderBy(asc(financeAccounts.displayOrder));

  // Group balances by date for net worth history
  const byDate: Record<string, Record<number, number>> = {};
  for (const b of balances) {
    if (!byDate[b.date]) byDate[b.date] = {};
    byDate[b.date][b.accountId] = b.amount;
  }

  const history = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, accountAmounts]) => ({
      date,
      netWorth: Object.values(accountAmounts).reduce((s, v) => s + v, 0),
    }));

  // Latest balances per account
  const latestByAccount: Record<number, number> = {};
  for (const b of balances) {
    if (!(b.accountId in latestByAccount)) latestByAccount[b.accountId] = b.amount;
  }

  return NextResponse.json({ accounts, latestByAccount, history });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { balances, date } = await req.json() as { balances: Record<number, number>; date: string };

  const rows = Object.entries(balances)
    .filter(([, amount]) => amount !== null && amount !== undefined)
    .map(([accountId, amount]) => ({ accountId: Number(accountId), amount: Number(amount), date }));

  if (rows.length) await db.insert(financeBalances).values(rows);
  return NextResponse.json({ ok: true, saved: rows.length });
}
