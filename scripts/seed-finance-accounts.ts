// @ts-nocheck
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { financeAccounts } from "../db/schema";

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function run() {
  const accounts = [
    { name: "Revolut (Current)", type: "current", currency: "EUR", displayOrder: 1 },
    { name: "ING", type: "current", currency: "EUR", displayOrder: 2 },
    { name: "Starling", type: "current", currency: "GBP", displayOrder: 3 },
    { name: "Revolut (Savings)", type: "savings", currency: "EUR", displayOrder: 4 },
    { name: "MyInvestor", type: "savings", currency: "EUR", displayOrder: 5 },
    { name: "Emergency Fund (Revolut)", type: "savings", currency: "EUR", displayOrder: 6 },
    { name: "Vanguard", type: "investment", currency: "EUR", displayOrder: 7 },
    { name: "IBKR", type: "investment", currency: "EUR", displayOrder: 8 },
    { name: "Retirement (MyInvestor)", type: "pension", currency: "EUR", displayOrder: 9 },
  ];
  await db.insert(financeAccounts).values(accounts);
  console.log(`Seeded ${accounts.length} accounts.`);
}

run().catch((e) => { console.error(e); process.exit(1); });
