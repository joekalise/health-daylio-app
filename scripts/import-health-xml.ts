// @ts-nocheck
// Usage: npm run import:health <path-to-export.xml>

import sax from "sax";
import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { healthMetrics } from "../db/schema";

const xmlPath = process.argv[2];
if (!xmlPath) {
  console.error("Usage: node --env-file=.env.local scripts/import-health-xml.mjs <path-to-export.xml>");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

// ── Type mappings ─────────────────────────────────────────────────────────────

const RECORD_TYPES = {
  HKQuantityTypeIdentifierStepCount:               { type: "steps",            unit: "count", agg: "sum" },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN:{ type: "hrv",              unit: "ms",    agg: "avg" },
  HKQuantityTypeIdentifierRestingHeartRate:         { type: "resting_hr",       unit: "bpm",   agg: "avg" },
  HKQuantityTypeIdentifierActiveEnergyBurned:       { type: "active_energy",    unit: "kcal",  agg: "sum" },
  HKQuantityTypeIdentifierDistanceWalkingRunning:   { type: "walking_distance", unit: "km",    agg: "sum" },
  HKQuantityTypeIdentifierFlightsClimbed:           { type: "flights_climbed",  unit: "count", agg: "sum" },
  HKQuantityTypeIdentifierBodyMass:                 { type: "weight",           unit: "kg",    agg: "avg" },
  HKQuantityTypeIdentifierOxygenSaturation:         { type: "spo2",             unit: "%",     agg: "avg" },
  HKQuantityTypeIdentifierHeartRate:                { type: "heart_rate",       unit: "bpm",   agg: "avg" },
  HKQuantityTypeIdentifierVO2Max:                   { type: "vo2max",           unit: "mL/kg/min", agg: "avg" },
  HKQuantityTypeIdentifierRespiratoryRate:          { type: "respiratory_rate", unit: "bpm",   agg: "avg" },
};

const SLEEP_TYPE = "HKCategoryTypeIdentifierSleepAnalysis";
const SLEEP_STAGES = {
  HKCategoryValueSleepAnalysisAsleepCore:        "core",
  HKCategoryValueSleepAnalysisAsleepDeep:        "deep",
  HKCategoryValueSleepAnalysisAsleepREM:         "rem",
  HKCategoryValueSleepAnalysisAsleepUnspecified: "unspecified",
  HKCategoryValueSleepAnalysisInBed:             "in_bed",
};

const WORKOUT_TYPES = {
  HKWorkoutActivityTypeRunning:       "Running",
  HKWorkoutActivityTypeCycling:       "Cycling",
  HKWorkoutActivityTypeWalking:       "Walking",
  HKWorkoutActivityTypeSwimming:      "Swimming",
  HKWorkoutActivityTypeYoga:          "Yoga",
  HKWorkoutActivityTypeStrengthTraining: "Strength",
  HKWorkoutActivityTypeHiit:          "HIIT",
  HKWorkoutActivityTypeElliptical:    "Elliptical",
  HKWorkoutActivityTypeRowing:        "Rowing",
  HKWorkoutActivityTypePilates:       "Pilates",
};

// ── Accumulators ──────────────────────────────────────────────────────────────

// date → type → { sum, count }
const dailyMetrics = {};
// date → { core, deep, rem, unspecified, in_bed } in seconds
const sleepByNight = {};
// array of workout rows
const workouts = [];

function dateKey(isoString) {
  // "2024-01-15 10:30:00 +0000" → "2024-01-15"
  return isoString.split(" ")[0];
}

function sleepNightKey(startDateStr) {
  // Attribute sleep to the night it started.
  // If start time is before noon → previous calendar day's night
  const d = new Date(startDateStr);
  if (d.getUTCHours() < 12) {
    const prev = new Date(d);
    prev.setUTCDate(prev.getUTCDate() - 1);
    return prev.toISOString().split("T")[0];
  }
  return d.toISOString().split("T")[0];
}

function addMetric(date, type, value) {
  if (!dailyMetrics[date]) dailyMetrics[date] = {};
  if (!dailyMetrics[date][type]) dailyMetrics[date][type] = { sum: 0, count: 0 };
  dailyMetrics[date][type].sum += value;
  dailyMetrics[date][type].count += 1;
}

// ── SAX streaming parse ───────────────────────────────────────────────────────

let processed = 0;
let skipped = 0;

const parser = sax.createStream(false, { lowercase: false, trim: true });

parser.on("opentag", (node) => {
  const attrs = node.attributes;

  if (node.name === "RECORD") {
    const hkType = attrs.TYPE;
    const mapping = RECORD_TYPES[hkType];

    if (mapping) {
      const value = parseFloat(attrs.VALUE);
      if (isNaN(value)) return;
      const date = dateKey(attrs.STARTDATE || attrs.CREATIONDATE);
      addMetric(date, mapping.type, value);
      processed++;
      return;
    }

    if (hkType === SLEEP_TYPE) {
      const stage = SLEEP_STAGES[attrs.VALUE];
      if (!stage) return;
      const start = new Date(attrs.STARTDATE);
      const end = new Date(attrs.ENDDATE);
      const durationSecs = (end - start) / 1000;
      if (durationSecs <= 0) return;
      const night = sleepNightKey(attrs.STARTDATE);
      if (!sleepByNight[night]) sleepByNight[night] = {};
      sleepByNight[night][stage] = (sleepByNight[night][stage] || 0) + durationSecs;
      processed++;
      return;
    }

    skipped++;
    return;
  }

  if (node.name === "WORKOUT") {
    const activityType = attrs.WORKOUTACTIVITYTYPE;
    const name = WORKOUT_TYPES[activityType] || activityType?.replace("HKWorkoutActivityType", "") || "Workout";
    const start = attrs.STARTDATE;
    const end = attrs.ENDDATE;
    if (!start || !end) return;
    const durationSecs = (new Date(end) - new Date(start)) / 1000;
    const date = dateKey(start);
    const energy = parseFloat(attrs.TOTALENERGYBURNED) || null;
    const distance = parseFloat(attrs.TOTALDISTANCE) || null;
    workouts.push({ date, name, durationSecs, energy, distance });
    processed++;
  }
});

// ── Insert helpers ────────────────────────────────────────────────────────────

const BATCH = 500;


async function flushAll() {
  const rows = [];

  // Daily aggregated metrics
  for (const [date, types] of Object.entries(dailyMetrics)) {
    for (const [type, { sum, count }] of Object.entries(types)) {
      const mapping = Object.values(RECORD_TYPES).find((m) => m.type === type);
      const value = mapping?.agg === "sum" ? sum : sum / count;
      rows.push({ date, type, value, unit: mapping?.unit ?? null, metadata: null, source: "apple_health" });
    }
  }

  // Sleep
  for (const [date, stages] of Object.entries(sleepByNight)) {
    const core = (stages.core || 0) / 3600;
    const deep = (stages.deep || 0) / 3600;
    const rem = (stages.rem || 0) / 3600;
    const unspecified = (stages.unspecified || 0) / 3600;
    const total = core + deep + rem + unspecified;
    if (total < 0.1) continue;
    rows.push({
      date,
      type: "sleep_total",
      value: Math.round(total * 100) / 100,
      unit: "hr",
      metadata: JSON.stringify({ core: Math.round(core * 100) / 100, deep: Math.round(deep * 100) / 100, rem: Math.round(rem * 100) / 100 }),
      source: "apple_health",
    });
  }

  // Workouts
  for (const w of workouts) {
    rows.push({
      date: w.date,
      type: "workout",
      value: Math.round(w.durationSecs),
      unit: "s",
      metadata: JSON.stringify({ name: w.name, energy: w.energy, distance: w.distance }),
      source: "apple_health",
    });
  }

  console.log(`\nInserting ${rows.length} rows into Neon...`);

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await db.insert(healthMetrics).values(batch).onConflictDoNothing();
    process.stdout.write(`\r  ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }

  console.log(`\nDone. ${rows.length} rows inserted.`);
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log(`Parsing ${path.basename(xmlPath)}...`);
const stream = fs.createReadStream(xmlPath, { encoding: "utf8" });

stream.on("error", (err) => { console.error("File error:", err.message); process.exit(1); });
parser.on("error", (err) => { console.error("Parse error:", err.message); });

let logInterval = setInterval(() => {
  process.stdout.write(`\r  Processed ${processed.toLocaleString()} records...`);
}, 500);

parser.on("end", async () => {
  clearInterval(logInterval);
  console.log(`\nParsed ${processed.toLocaleString()} records (${skipped.toLocaleString()} skipped)`);
  await flushAll();
  process.exit(0);
});

stream.pipe(parser);
