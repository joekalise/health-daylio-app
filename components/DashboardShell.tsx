"use client";

import { useState } from "react";
import MoodLoggerWrapper from "./MoodLoggerWrapper";
import MoodChart from "./MoodChart";
import ActivityHeatmap from "./ActivityHeatmap";
import HealthSection from "./HealthSection";
import InsightsSection from "./InsightsSection";
import FinanceSection from "./FinanceSection";
import ProfileSection from "./ProfileSection";
import { MOOD_EMOJI, MOOD_COLORS } from "@/lib/mood";
import { format, parseISO, isToday, isYesterday, subDays } from "date-fns";
import Link from "next/link";

interface Entry {
  id: number;
  date: string;
  mood: string;
  moodScore: number;
  activities: string[] | null;
  note: string | null;
}

interface Props {
  entries: Entry[];
  chartData: { date: string; moodScore: number; mood: string }[];
  avgScore: string;
  streak: number;
  todayLogged: boolean;
}

const TABS = ["Today", "Mood", "Health", "Finance", "Insights", "Profile"] as const;
type Tab = typeof TABS[number];

const RANGES = [30, 90, 180, 365, 1825] as const;
type Range = typeof RANGES[number];
const RANGE_LABELS: Record<Range, string> = { 30: "30d", 90: "90d", 180: "6m", 365: "1y", 1825: "All" };

function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex gap-1">
      {RANGES.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            value === r ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {RANGE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}

function relativeDate(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardShell({ entries, chartData, avgScore, streak, todayLogged }: Props) {
  const [tab, setTab] = useState<Tab>(todayLogged ? "Mood" : "Today");
  const [days, setDays] = useState<Range>(1825);

  const cutoff = subDays(new Date(), days).toISOString().split("T")[0];
  const filteredEntries = entries.filter((e) => e.date >= cutoff);
  const filteredChartData = chartData.filter((e) => e.date >= cutoff);
  const recent = filteredEntries.slice(0, 10);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="px-4 pt-6 pb-2 max-w-2xl mx-auto">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-zinc-400 text-sm">{format(new Date(), "EEEE, MMMM d")}</p>
            <h1 className="text-2xl font-bold mt-0.5">{getGreeting()} 👋</h1>
          </div>
          <a href="/api/auth/signout" className="text-xs text-zinc-600 hover:text-zinc-400 mt-1 transition-colors">
            Sign out
          </a>
        </div>

        {/* Quick stats */}
        <div className="flex gap-3 mt-4">
          <div className="flex-1 bg-zinc-900 rounded-xl px-3 py-2.5 text-center">
            <div className="text-xl font-bold text-indigo-400">{entries.length.toLocaleString()}</div>
            <div className="text-xs text-zinc-500 mt-0.5">days logged</div>
          </div>
          <div className="flex-1 bg-zinc-900 rounded-xl px-3 py-2.5 text-center">
            <div className="text-xl font-bold text-indigo-400">{avgScore}</div>
            <div className="text-xs text-zinc-500 mt-0.5">avg mood</div>
          </div>
          <div className="flex-1 bg-zinc-900 rounded-xl px-3 py-2.5 text-center">
            <div className="text-xl font-bold text-indigo-400">{streak}</div>
            <div className="text-xs text-zinc-500 mt-0.5">day streak</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 bg-zinc-900 rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t}
              {t === "Today" && !todayLogged && (
                <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block align-middle" />
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* TODAY TAB */}
        {tab === "Today" && (
          <>
            {todayLogged ? (
              <div className="bg-zinc-900 rounded-2xl p-5 text-center space-y-2">
                <div className="text-4xl">{MOOD_EMOJI[entries[0].mood]}</div>
                <p className="font-medium capitalize">{entries[0].mood}</p>
                <p className="text-xs text-zinc-500">Logged today</p>
                {entries[0].activities && entries[0].activities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                    {entries[0].activities.map((a) => (
                      <span key={a} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{a}</span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setTab("Mood")}
                  className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  View all entries →
                </button>
              </div>
            ) : (
              <div className="bg-zinc-900 rounded-2xl p-4">
                <h2 className="font-medium mb-4">How are you feeling today?</h2>
                <MoodLoggerWrapper onSavedTab={() => setTab("Mood")} />
              </div>
            )}
          </>
        )}

        {/* MOOD TAB */}
        {tab === "Mood" && (
          <>
            <section className="bg-zinc-900 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-medium">Mood over time</h2>
                <RangePicker value={days} onChange={setDays} />
              </div>
              <MoodChart data={filteredChartData} />
            </section>

            <section className="bg-zinc-900 rounded-2xl p-4">
              <h2 className="font-medium mb-4">Activities & mood</h2>
              <ActivityHeatmap entries={filteredEntries.map((e) => ({ activities: e.activities ?? [], moodScore: e.moodScore }))} />
            </section>

            <section className="bg-zinc-900 rounded-2xl p-4">
              <h2 className="font-medium mb-3">Recent entries</h2>
              <div className="space-y-0">
                {recent.map((e, i) => (
                  <Link key={e.id} href={`/entries/${e.id}`} className={`flex items-start gap-3 py-3 hover:bg-zinc-800/50 -mx-1 px-1 rounded-xl transition-colors ${i < recent.length - 1 ? "border-b border-zinc-800" : ""}`}>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: MOOD_COLORS[e.mood] + "22" }}
                    >
                      {MOOD_EMOJI[e.mood]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="text-sm font-medium capitalize" style={{ color: MOOD_COLORS[e.mood] }}>{e.mood}</span>
                        <span className="text-xs text-zinc-500 flex-shrink-0">{relativeDate(e.date)}</span>
                      </div>
                      {e.activities && e.activities.length > 0 && (
                        <p className="text-xs text-zinc-500 mt-0.5 truncate">{e.activities.join(" · ")}</p>
                      )}
                      {e.note && <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{e.note}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="bg-zinc-900 rounded-2xl p-4">
              <h2 className="font-medium mb-3">Import data</h2>
              <a href="/import" className="block w-full text-center py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition-colors">
                Import Daylio CSV
              </a>
            </section>
          </>
        )}

        {/* FINANCE TAB */}
        {tab === "Finance" && (
          <section className="bg-zinc-900 rounded-2xl p-4">
            <h2 className="font-medium mb-4">Finances</h2>
            <FinanceSection />
          </section>
        )}

        {/* INSIGHTS TAB */}
        {tab === "Insights" && (
          <section className="bg-zinc-900 rounded-2xl p-4">
            <h2 className="font-medium mb-4">Insights</h2>
            <InsightsSection entries={entries} />
          </section>
        )}

        {/* PROFILE TAB */}
        {tab === "Profile" && (
          <section className="bg-zinc-900 rounded-2xl p-4">
            <h2 className="font-medium mb-1">Your profile</h2>
            <p className="text-xs text-zinc-500 mb-4">Used to personalise the AI chatbot</p>
            <ProfileSection />
          </section>
        )}

        {/* HEALTH TAB */}
        {tab === "Health" && (
          <section className="bg-zinc-900 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-medium">Health metrics</h2>
              <RangePicker value={days} onChange={setDays} />
            </div>
            <HealthSection days={days} />
          </section>
        )}
      </main>
    </div>
  );
}
