// @ts-nocheck
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

const sqlClient = neon(process.env.DATABASE_URL);
const db = drizzle(sqlClient);

async function run() {
  const first5 = await db.execute(sql`SELECT date, SUM(amount) as net_worth FROM finance_balances GROUP BY date ORDER BY date LIMIT 5`);
  const last3 = await db.execute(sql`SELECT date, SUM(amount) as net_worth FROM finance_balances GROUP BY date ORDER BY date DESC LIMIT 3`);
  const count = await db.execute(sql`SELECT COUNT(DISTINCT date) as months FROM finance_balances`);
  console.log("Total months:", count.rows[0].months);
  console.log("First 5 months:", first5.rows.map(r => `${r.date}: €${Number(r.net_worth).toFixed(0)}`).join(", "));
  console.log("Last 3 months:", last3.rows.map(r => `${r.date}: €${Number(r.net_worth).toFixed(0)}`).join(", "));
}

run().catch(e => { console.error(e); process.exit(1); });
