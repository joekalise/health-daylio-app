import { pgTable, text, integer, real, timestamp, date, jsonb, serial, numeric, boolean, uniqueIndex } from "drizzle-orm/pg-core";

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
}, (t) => [
  uniqueIndex("health_metrics_date_type_unique").on(t.date, t.type),
]);

export const financeSnapshots = pgTable("finance_snapshots", {
  id: serial("id").primaryKey(),
  importedAt: timestamp("imported_at").defaultNow().notNull(),
  source: text("source").notNull().default("excel"),
});

export const financeEntries = pgTable("finance_entries", {
  id: serial("id").primaryKey(),
  snapshotId: integer("snapshot_id").notNull(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  value: real("value").notNull(),
  currency: text("currency").notNull().default("EUR"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Manual balance tracking — accounts the user defines once
export const financeAccounts = pgTable("finance_accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // current | savings | investment | pension
  currency: text("currency").notNull().default("EUR"),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  isNetWorth: boolean("is_net_worth").notNull().default(true),
});

// Monthly balance snapshots per account
export const financeBalances = pgTable("finance_balances", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  amount: real("amount").notNull(),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Strava OAuth tokens (single row — personal app)
export const stravaTokens = pgTable("strava_tokens", {
  id: serial("id").primaryKey(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: integer("expires_at").notNull(), // Unix timestamp
  athleteId: integer("athlete_id").notNull().unique(),
  athleteName: text("athlete_name"),
  athletePhoto: text("athlete_photo"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workouts synced from Strava (separate from health_metrics to allow multiple/day)
export const workouts = pgTable("workouts", {
  id: serial("id").primaryKey(),
  stravaId: text("strava_id").unique(),
  date: date("date").notNull(),
  name: text("name").notNull(),
  sportType: text("sport_type").notNull(),
  durationSecs: integer("duration_secs").notNull(),
  distanceMeters: real("distance_meters"),
  elevationGain: real("elevation_gain"),
  avgHeartrate: real("avg_heartrate"),
  calories: real("calories"),
  source: text("source").notNull().default("strava"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User profile for personalising Claude's responses
export const userProfile = pgTable("user_profile", {
  id: serial("id").primaryKey(),
  name: text("name"),
  age: integer("age"),
  occupation: text("occupation"),
  location: text("location"),
  healthConditions: text("health_conditions"),
  medications: text("medications"),
  fitnessGoals: text("fitness_goals"),
  financialGoals: text("financial_goals"),
  about: text("about"),
  photo: text("photo"), // base64 data URL
  updatedAt: timestamp("updated_at").defaultNow(),
});
