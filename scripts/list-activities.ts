// @ts-nocheck
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
async function run() {
  const rows = await sql`SELECT DISTINCT unnest(activities) as activity FROM mood_entries ORDER BY activity`;
  console.log(rows.map(r => r.activity).join("\n"));
}
run();
