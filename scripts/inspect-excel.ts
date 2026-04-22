// @ts-nocheck
import * as XLSX from "xlsx";
import path from "path";

const filePath = process.argv[2] || path.join(process.cwd(), "Spain Budget.xlsx");
const wb = XLSX.readFile(filePath);

console.log("Sheets:", wb.SheetNames);
console.log("\n---");

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  console.log(`\nSheet: "${name}" (${data.length} rows)`);
  // Print first 10 rows
  data.slice(0, 10).forEach((row, i) => console.log(`  [${i}]`, JSON.stringify(row)));
}
