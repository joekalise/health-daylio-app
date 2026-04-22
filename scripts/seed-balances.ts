// @ts-nocheck
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { financeAccounts, financeBalances } from "../db/schema";
import XLSX from "xlsx";
import { sql as drizzleSql } from "drizzle-orm";

const sqlClient = neon(process.env.DATABASE_URL);
const db = drizzle(sqlClient);

function excelSerialToDate(serial: number): string {
  const d = new Date((serial - 25569) * 86400 * 1000);
  return d.toISOString().split("T")[0];
}

async function run() {
  // ── 1. Clear existing data ──────────────────────────────────────────────────
  await db.execute(drizzleSql`DELETE FROM finance_balances`);
  await db.execute(drizzleSql`DELETE FROM finance_accounts`);
  console.log("Cleared existing data.");

  // ── 2. Create accounts matching the spreadsheet exactly ────────────────────
  // isNetWorth: false = excluded from net worth (e.g. tax savings accounts)
  const inserted = await db.insert(financeAccounts).values([
    // Current Accounts — only Revolut is included in net worth
    { name: "Revolut",                type: "current",    currency: "EUR", displayOrder: 1,  isNetWorth: true  },
    { name: "ING",                    type: "current",    currency: "EUR", displayOrder: 2,  isNetWorth: false },
    { name: "Starling (GBP)",         type: "current",    currency: "GBP", displayOrder: 3,  isNetWorth: false },
    { name: "Tax Savings (Revolut)",  type: "current",    currency: "EUR", displayOrder: 4,  isNetWorth: false },
    // Savings
    { name: "MyInvestor Savings",     type: "savings",    currency: "EUR", displayOrder: 5,  isNetWorth: true  },
    { name: "Emergency Fund (Revolut)", type: "savings",  currency: "EUR", displayOrder: 6,  isNetWorth: true  },
    // Pensions
    { name: "Pension (SIPP)",         type: "pension",    currency: "EUR", displayOrder: 7,  isNetWorth: true  },
    // Investments
    { name: "MyInvestor Index",       type: "investment", currency: "EUR", displayOrder: 8,  isNetWorth: true  },
    { name: "Crypto",                 type: "investment", currency: "EUR", displayOrder: 9,  isNetWorth: true  },
    { name: "Revolut Portfolio",      type: "investment", currency: "EUR", displayOrder: 10, isNetWorth: true  },
    // Historical only (used for Sheet16 import, now 0)
    { name: "Flat Equity",            type: "investment", currency: "EUR", displayOrder: 11, isNetWorth: true  },
  ]).returning({ id: financeAccounts.id, name: financeAccounts.name });

  const idFor = (name: string) => inserted.find(a => a.name === name)!.id;
  const revolut     = idFor("Revolut");
  const savingsEM   = idFor("Emergency Fund (Revolut)");
  const invest      = idFor("MyInvestor Index");
  const equity      = idFor("Flat Equity");
  console.log("Created accounts:", inserted.map(a => `${a.id}:${a.name}`).join(", "));

  // ── 3. Import Sheet16 history ───────────────────────────────────────────────
  // Columns: year/blank, serial date, Main Balance, Savings, Investments, Flat Equity, Subtotal, Net Worth
  // Map: Main Balance → Revolut, Savings → Emergency Fund, Investments → MyInvestor Index
  const wb = XLSX.readFile("Spain Budget (1).xlsx");
  const sheet = wb.Sheets["Sheet16"];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];

  const historyRows: typeof financeBalances.$inferInsert[] = [];
  let skipped = 0;

  for (const row of rows) {
    const serial = row[1];
    if (typeof serial !== "number" || serial < 40000) continue;
    const main = typeof row[2] === "number" ? row[2] : null;
    const sav  = typeof row[3] === "number" ? row[3] : null;
    const inv  = typeof row[4] === "number" ? row[4] : null;
    const eq   = typeof row[5] === "number" ? row[5] : null;
    if (main === null && sav === null && inv === null) { skipped++; continue; }

    const date = excelSerialToDate(serial);
    if (main !== null) historyRows.push({ accountId: revolut,   amount: main, date });
    if (sav  !== null) historyRows.push({ accountId: savingsEM, amount: sav,  date });
    if (inv  !== null) historyRows.push({ accountId: invest,    amount: inv,  date });
    if (eq   !== null && eq > 0) historyRows.push({ accountId: equity, amount: eq, date });
  }

  for (let i = 0; i < historyRows.length; i += 200) {
    await db.insert(financeBalances).values(historyRows.slice(i, i + 200));
  }
  console.log(`Imported ${historyRows.length} historical rows (skipped ${skipped} empty months).`);

  // ── 4. Current balances — April 2026 from Balances sheet ───────────────────
  // Net worth: Revolut + Savings + Pension + Investments = 75,118.15
  const currentDate = "2026-04-22";
  await db.insert(financeBalances).values([
    { accountId: idFor("Revolut"),                  amount: 463.53,    date: currentDate },
    { accountId: idFor("ING"),                      amount: 3084.04,   date: currentDate },
    { accountId: idFor("Starling (GBP)"),           amount: 0,         date: currentDate },
    { accountId: idFor("Tax Savings (Revolut)"),    amount: 26300.88,  date: currentDate },
    { accountId: idFor("MyInvestor Savings"),       amount: 18.04,     date: currentDate },
    { accountId: idFor("Emergency Fund (Revolut)"), amount: 750.82,    date: currentDate },
    { accountId: idFor("Pension (SIPP)"),           amount: 19089.93,  date: currentDate },
    { accountId: idFor("MyInvestor Index"),         amount: 50895.32,  date: currentDate },
    { accountId: idFor("Crypto"),                   amount: 261.61,    date: currentDate },
    { accountId: idFor("Revolut Portfolio"),        amount: 3638.90,   date: currentDate },
    { accountId: idFor("Flat Equity"),              amount: 0,         date: currentDate },
  ]);

  const netWorth = 463.53 + 18.04 + 750.82 + 19089.93 + 50895.32 + 261.61 + 3638.90;
  console.log(`\nCurrent net worth (April 2026): €${netWorth.toFixed(2)}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
