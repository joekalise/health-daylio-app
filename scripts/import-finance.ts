// @ts-nocheck
// Usage: npm run import:finance [path-to-excel]

import * as XLSX from "xlsx";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { financeSnapshots, financeEntries } from "../db/schema";

const filePath = process.argv[2] || path.join(process.cwd(), "Spain Budget.xlsx");
const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

function num(v: any): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
}

function str(v: any): string {
  return v == null ? "" : String(v).trim();
}

async function run() {
  const wb = XLSX.readFile(filePath);
  const rows: typeof financeEntries.$inferInsert[] = [];

  // Create snapshot
  const [snap] = await db.insert(financeSnapshots).values({ source: "excel" }).returning();
  const snapshotId = snap.id;

  // ── Income ──────────────────────────────────────────────────────────────────
  const incomeSheet = XLSX.utils.sheet_to_json(wb.Sheets["Income"], { header: 1, defval: "" });
  for (const row of incomeSheet) {
    const name = str(row[0]);
    const monthly = num(row[2]);
    if (!name || !monthly || name.toLowerCase().includes("total") || name.toLowerCase().includes("income type") || name.toLowerCase().includes("income")) continue;
    rows.push({ snapshotId, category: "income", name, value: monthly, metadata: { weekly: num(row[1]), yearly: num(row[3]) } });
  }

  // ── Expenditure ─────────────────────────────────────────────────────────────
  const expSheet = XLSX.utils.sheet_to_json(wb.Sheets["Expenditure"], { header: 1, defval: "" });
  let currentGroup = "";
  for (const row of expSheet) {
    const name = str(row[0]);
    const monthly = num(row[1]);
    if (!name) continue;
    // Detect group headers (no monthly value, not a sub-item)
    if (!monthly && name && !name.toLowerCase().includes("total") && !name.toLowerCase().includes("monthly")) {
      currentGroup = name;
      continue;
    }
    if (!monthly || name.toLowerCase().includes("total") || name.toLowerCase().includes("expenditure")) continue;
    rows.push({
      snapshotId,
      category: "expense",
      name,
      value: monthly,
      metadata: {
        group: currentGroup,
        percentOfIncome: num(row[2]),
        account: str(row[3]),
        notes: str(row[4]),
        dueDate: str(row[5]),
        type: str(row[6]),
      },
    });
  }

  // ── Balances ─────────────────────────────────────────────────────────────────
  const balSheet = XLSX.utils.sheet_to_json(wb.Sheets["Balances"], { header: 1, defval: "" });
  let balGroup = "";
  for (const row of balSheet) {
    const groupOrEmpty = str(row[0]);
    const name = str(row[1]);
    const balance = num(row[2]);
    if (groupOrEmpty && !name) continue;
    if (groupOrEmpty) balGroup = groupOrEmpty;
    if (!name || balance == null || name.toLowerCase() === "total" || name.toLowerCase() === "account") continue;
    rows.push({
      snapshotId,
      category: "balance",
      name,
      value: balance,
      metadata: { group: balGroup, notes: str(row[3]), portfolioPct: num(row[7]) },
    });
  }

  // ── Savings Goals ────────────────────────────────────────────────────────────
  const goalsSheet = XLSX.utils.sheet_to_json(wb.Sheets["Savings Goals"], { header: 1, defval: "" });
  for (const row of goalsSheet) {
    const name = str(row[0]).trim();
    const saved = num(row[1]);
    const goal = num(row[2]);
    if (!name || saved == null || !goal || name.toLowerCase() === "total" || name.toLowerCase().includes("amount")) continue;
    rows.push({
      snapshotId,
      category: "savings_goal",
      name,
      value: saved,
      metadata: { goalAmount: goal, percentComplete: num(row[3]), storedIn: str(row[4]) },
    });
  }

  // ── Investments (V&E) ────────────────────────────────────────────────────────
  const veSheet = XLSX.utils.sheet_to_json(wb.Sheets["V&E"], { header: 1, defval: "" });
  for (const row of veSheet) {
    const name = str(row[1]);
    const balance = num(row[2]);
    if (!name || balance == null || name.toLowerCase() === "account" || name.toLowerCase() === "total") continue;
    rows.push({ snapshotId, category: "investment", name, value: balance });
  }

  console.log(`Inserting ${rows.length} finance entries...`);
  for (let i = 0; i < rows.length; i += 100) {
    await db.insert(financeEntries).values(rows.slice(i, i + 100));
  }
  console.log("Done.");
}

run().catch((e) => { console.error(e); process.exit(1); });
