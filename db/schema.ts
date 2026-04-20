import { pgTable, text, integer, real, timestamp, date, jsonb, serial } from "drizzle-orm/pg-core";

export const moodEntries = pgTable("mood_entries", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  time: text("time"),
  mood: text("mood").notNull(), // rad, good, meh, bad, awful
  moodScore: integer("mood_score").notNull(), // 5,4,3,2,1
  activities: text("activities").array().notNull().default([]),
  noteTitle: text("note_title"),
  note: text("note"),
  source: text("source").notNull().default("manual"), // daylio_import | manual
  createdAt: timestamp("created_at").defaultNow(),
});

export const healthMetrics = pgTable("health_metrics", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  type: text("type").notNull(), // steps, hrv, sleep_duration, sleep_deep, sleep_rem, workout, resting_hr, etc.
  value: real("value").notNull(),
  unit: text("unit"),
  metadata: jsonb("metadata"), // workout name, sleep stages, etc.
  source: text("source").notNull().default("apple_health"),
  createdAt: timestamp("created_at").defaultNow(),
});
