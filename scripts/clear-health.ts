// @ts-nocheck
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { healthMetrics } from "../db/schema";

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function run() {
  await db.delete(healthMetrics);
  console.log("Health metrics cleared.");
}

run().catch((e) => { console.error(e); process.exit(1); });
