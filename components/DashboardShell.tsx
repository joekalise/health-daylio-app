"use client";

import { useState, useEffect } from "react";
import MoodLoggerWrapper from "./MoodLoggerWrapper";
import MoodChart from "./MoodChart";
import ActivityHeatmap from "./ActivityHeatmap";
import HealthSection from "./HealthSection";
import InsightsSection from "./InsightsSection";
import FinanceSection from "./FinanceSection";
import ProfileSection from "./ProfileSection";
import ChatPanel from "./ChatPanel";
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

const TABS = [
  { id: "Today", emoji: "🌤️" },
  { id: "Mood", emoji: "😊" },
  { id: "Health", emoji: "💪" },
  { id: "Finance", emoji: "💰" },
  { id: "Insights", emoji: "✨" },
  { id: "Chat", emoji: "💬" },
] as const;
type Tab = typeof TABS[number]["id"] | "Profile";

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
            value === r
              ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/40"
              : "text-zinc-500 hover:text-zinc-300"
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

function Avatar({ photo, name, onClick }: { photo?: string | null; name?: string | null; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/10 hover:border-indigo-500/50 transition-all flex-shrink-0"
      style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
    >
      {photo ? (
        <img src={photo} alt="profile" className="w-full h-full object-cover" />
      ) : (
        <span className="w-full h-full flex items-center justify-center text-sm font-bold text-white">
          {name ? name[0].toUpperCase() : "?"}
        </span>
      )}
    </button>
  );
}

export default function DashboardShell({ entries, chartData, avgScore, streak, todayLogged }: Props) {
  const [tab, setTab] = useState<Tab>(todayLogged ? "Mood" : "Today");
  const [days, setDays] = useState<Range>(30);
  const [profile, setProfile] = useState<{ name?: string; photo?: string } | null>(null);

  useEffect(() => {
    fetch("/api/profile").then(r => r.json()).then(d => { if (d) setProfile(d); });
  }, []);

  const cutoff = subDays(new Date(), days).toISOString().split("T")[0];
  const filteredEntries = entries.filter((e) => e.date >= cutoff);
  const filteredChartData = chartData.filter((e) => e.date >= cutoff);
  const recent = filteredEntries.slice(0, 10);

  return (
    <div className="min-h-screen text-white pb-28">
      {/* Header */}
      <header className="px-4 pt-8 pb-2 max-w-2xl mx-auto">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-zinc-500 text-xs tracking-wide uppercase">{format(new Date(), "EEEE, MMMM d")}</p>
            <h1 className="text-3xl font-bold mt-1 grad-text">{getGreeting()}</h1>
          </div>
          <Avatar photo={profile?.photo} name={profile?.name} onClick={() => setTab("Profile")} />
        </div>

        {/* Stats — only shown on mood-relevant tabs */}
        {(tab === "Today" || tab === "Mood") && (
          <div className="flex gap-2.5 mt-5">
            <div className="flex-1 rounded-2xl px-3 py-3 text-center" style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
              <div className="text-xl font-bold text-indigo-300">{entries.length.toLocaleString()}</div>
              <div className="text-[10px] text-indigo-400/70 mt-0.5 uppercase tracking-wide">Days logged</div>
            </div>
            <div className="flex-1 rounded-2xl px-3 py-3 text-center" style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)" }}>
              <div className="text-xl font-bold text-violet-300">{avgScore}</div>
              <div className="text-[10px] text-violet-400/70 mt-0.5 uppercase tracking-wide">Avg mood</div>
            </div>
            <div className="flex-1 rounded-2xl px-3 py-3 text-center" style={{ background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.25)" }}>
              <div className="text-xl font-bold text-orange-300">{streak} 🔥</div>
              <div className="text-[10px] text-orange-400/70 mt-0.5 uppercase tracking-wide">Day streak</div>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* TODAY TAB */}
        {tab === "Today" && (
          <>
            {todayLogged ? (
              <div className="glass rounded-2xl p-6 text-center space-y-3">
                <div className="text-5xl">{MOOD_EMOJI[entries[0].mood]}</div>
                <div>
                  <p className="font-semibold capitalize text-lg" style={{ color: MOOD_COLORS[entries[0].mood] }}>{entries[0].mood}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Logged today</p>
                </div>
                {entries[0].activities && entries[0].activities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                    {entries[0].activities.map((a) => (
                      <span key={a} className="text-xs bg-white/5 border border-white/10 text-zinc-300 px-2.5 py-0.5 rounded-full">{a}</span>
                    ))}
                  </div>
                )}
                <button onClick={() => setTab("Mood")} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  View all entries →
                </button>
              </div>
            ) : (
              <div className="glass rounded-2xl p-5 text-center">
                <h2 className="font-semibold text-lg mb-4">How are you feeling?</h2>
                <MoodLoggerWrapper onSavedTab={() => setTab("Mood")} />
              </div>
            )}
          </>
        )}

        {/* MOOD TAB */}
        {tab === "Mood" && (
          <>
            <section className="glass rounded-2xl p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold">Mood over time</h2>
                <RangePicker value={days} onChange={setDays} />
              </div>
              <MoodChart data={filteredChartData} />
            </section>

            <section className="glass rounded-2xl p-4">
              <h2 className="font-semibold mb-3">Recent entries</h2>
              <div className="space-y-0">
                {recent.map((e, i) => (
                  <Link key={e.id} href={`/entries/${e.id}`} className={`flex items-start gap-3 py-3 hover:bg-white/5 -mx-1 px-1 rounded-xl transition-colors ${i < recent.length - 1 ? "border-b border-white/5" : ""}`}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 mt-0.5" style={{ backgroundColor: MOOD_COLORS[e.mood] + "22" }}>
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

            <section className="glass rounded-2xl p-4">
              <h2 className="font-semibold mb-3">Import data</h2>
              <a href="/import" className="block w-full text-center py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-zinc-300 transition-colors border border-white/8">
                Import Daylio CSV
              </a>
            </section>
          </>
        )}

        {/* HEALTH TAB */}
        {tab === "Health" && (
          <section className="glass rounded-2xl p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Health metrics</h2>
              <RangePicker value={days} onChange={setDays} />
            </div>
            <HealthSection days={days} />
          </section>
        )}

        {/* FINANCE TAB */}
        {tab === "Finance" && (
          <FinanceSection />
        )}

        {/* INSIGHTS TAB */}
        {tab === "Insights" && (
          <section className="glass rounded-2xl p-4">
            <h2 className="font-semibold mb-4">Insights</h2>
            <InsightsSection entries={entries} />
          </section>
        )}

        {/* CHAT TAB */}
        {tab === "Chat" && (
          <section className="glass rounded-2xl p-4">
            <h2 className="font-semibold mb-4">Ask about your data</h2>
            <ChatPanel />
          </section>
        )}

        {/* PROFILE TAB */}
        {tab === "Profile" && (
          <section className="glass rounded-2xl p-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="font-semibold">Profile</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Personalises the AI chatbot</p>
              </div>
              <a href="/api/auth/signout" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Sign out</a>
            </div>
            <ProfileSection onPhotoChange={(photo) => setProfile(p => ({ ...p, photo }))} />
          </section>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50" style={{ background: "rgba(7,7,15,0.85)", borderTop: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(20px)" }}>
        <div className="flex max-w-2xl mx-auto">
          {TABS.map(({ id, emoji }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-all relative"
            >
              {tab === id && (
                <span className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />
              )}
              <span className={`text-xl transition-all ${tab === id ? "scale-110" : "opacity-50"}`}>{emoji}</span>
              <span className={`text-[10px] font-medium tracking-wide ${tab === id ? "text-indigo-400" : "text-zinc-600"}`}>{id}</span>
              {id === "Today" && !todayLogged && tab !== "Today" && (
                <span className="absolute top-2 right-[calc(50%-14px)] w-1.5 h-1.5 rounded-full bg-indigo-400" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
