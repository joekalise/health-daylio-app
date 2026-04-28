"use client";

import { useState, useEffect } from "react";
import MoodLoggerWrapper from "./MoodLoggerWrapper";
import MoodChart from "./MoodChart";
import ActivityHeatmap from "./ActivityHeatmap";
import HealthSection from "./HealthSection";
import InsightsSection from "./InsightsSection";
import FinanceSection from "./FinanceSection";
import SettingsPanel from "./SettingsPanel";
import ChatPanel from "./ChatPanel";
import { MOOD_EMOJI, MOOD_COLORS } from "@/lib/mood";
import { format, parseISO, isToday, isYesterday, subDays, addDays, startOfWeek } from "date-fns";
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
          className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
          style={value === r
            ? { background: "var(--c-primary-dim)", color: "var(--c-primary)", border: "1px solid var(--c-primary-border)" }
            : { color: "var(--text-muted)" }
          }
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

interface FlareRisk {
  level: "warning" | "high";
  reasons: string[];
  advice: string;
}

function computeFlareRisk(entries: Entry[]): FlareRisk | null {
  if (entries.length < 7) return null;

  const now = new Date();
  const d = (n: number) => subDays(now, n).toISOString().split("T")[0];

  const last3 = entries.filter(e => e.date >= d(3));
  const last7 = entries.filter(e => e.date >= d(7));
  const last14 = entries.filter(e => e.date >= d(14));
  const baseline = entries.filter(e => e.date >= d(90));

  const avg = (arr: Entry[]) => arr.length ? arr.reduce((s, e) => s + e.moodScore, 0) / arr.length : null;
  const hasActivity = (arr: Entry[], act: string) => arr.some(e => e.activities?.includes(act));
  const countActivity = (arr: Entry[], act: string) => arr.filter(e => e.activities?.includes(act)).length;

  const baselineAvg = avg(baseline) ?? 3.5;
  const recent3Avg = avg(last3);
  const recent14Avg = avg(last14);

  const reasons: string[] = [];

  // ── AS flare triggers ────────────────────────────────────────────
  // Sick / immune stress — a big AS trigger
  if (hasActivity(last7, "sick")) {
    reasons.push("Illness logged — infections are a known AS flare trigger");
  }

  // Sleep quality poor — poor sleep spikes inflammatory markers
  const badSleepDays = countActivity(last7, "bad sleep") + countActivity(last7, "medium sleep");
  const goodSleepDays = countActivity(last7, "good sleep");
  if (badSleepDays >= 3 && badSleepDays > goodSleepDays) {
    reasons.push(`${badSleepDays} nights of poor sleep — disrupted sleep worsens AS inflammation`);
  }

  // No exercise when they usually do — movement is protective for AS
  const usuallyExercises = countActivity(baseline, "exercise") / Math.max(baseline.length, 1) > 0.2;
  if (usuallyExercises && !hasActivity(last7, "exercise")) {
    reasons.push("No movement in 7 days — exercise helps keep AS in check");
  }

  // Mood in free-fall — pain + mood are bidirectional in AS
  if (recent3Avg !== null && recent3Avg < baselineAvg - 0.8) {
    reasons.push(`Mood ${(baselineAvg - recent3Avg).toFixed(1)} pts below your normal — often precedes or accompanies a flare`);
  }

  // Declining trajectory
  if (last3.length >= 3) {
    const sorted = [...last3].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted[0].moodScore > sorted[sorted.length - 1].moodScore + 1) {
      reasons.push("Mood declining day-on-day this week");
    }
  }

  // Stress indicators (AS is stress-sensitive)
  const anxietyAttacks = countActivity(last7, "anxiety attack");
  if (anxietyAttacks > 0) {
    reasons.push(`${anxietyAttacks} anxiety attack${anxietyAttacks > 1 ? "s" : ""} — stress is a major AS trigger`);
  }

  // Alcohol — pro-inflammatory
  const alcoholDays = last7.filter(e => e.activities && !e.activities.includes("no alcohol")).length;
  if (alcoholDays >= 4 && last7.length >= 5) {
    reasons.push("High alcohol intake this week — pro-inflammatory, can trigger AS flares");
  }

  // Worse than 2-week avg
  if (recent3Avg !== null && recent14Avg !== null && recent3Avg < recent14Avg - 0.6 && recent3Avg < 3) {
    if (!reasons.some(r => r.includes("pts below"))) {
      reasons.push("Notably worse than your 2-week average");
    }
  }

  if (reasons.length === 0) return null;

  const isHighRisk = reasons.length >= 3 || hasActivity(last3, "sick") || (recent3Avg !== null && recent3Avg < 2.3);
  const level: FlareRisk["level"] = isHighRisk ? "high" : "warning";

  const highAdvice = [
    "Multiple warning signs active. Rest, anti-inflammatories if needed, and avoid anything that taxes your immune system right now.",
    "Your data is stacking up warning signs. This is the time to be proactive, not push through.",
    "Seriously — protect your sleep, cut alcohol, and move gently. Don't wait for the flare to arrive.",
  ];
  const warnAdvice = [
    "Early warning signs for an AS flare. Prioritise sleep, keep moving, and manage stress before this escalates.",
    "Your patterns suggest inflammation may be building. Now's cheaper than dealing with a full flare.",
    "Get ahead of this — gentle movement, good sleep, low stress. Your body is giving you a head start.",
  ];

  const idx = Math.floor(Date.now() / 86400000);
  const advice = level === "high" ? highAdvice[idx % highAdvice.length] : warnAdvice[idx % warnAdvice.length];

  return { level, reasons, advice };
}

function FlareWarning({ risk }: { risk: FlareRisk }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const isHigh = risk.level === "high";
  const bg = isHigh ? "var(--c-negative-dim)" : "rgba(251,146,60,0.12)";
  const border = isHigh ? "var(--c-negative)" : "#f97316";
  const color = isHigh ? "var(--c-negative)" : "#f97316";

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: bg, border: `1px solid ${border}40` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{isHigh ? "🚨" : "⚠️"}</span>
          <p className="font-semibold text-sm" style={{ color }}>
            {isHigh ? "AS flare risk: High" : "AS flare warning — early signs"}
          </p>
        </div>
        <button onClick={() => setDismissed(true)} className="text-xs flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }}>dismiss</button>
      </div>
      <ul className="space-y-1">
        {risk.reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-dim)" }}>
            <span className="mt-0.5 flex-shrink-0" style={{ color }}>›</span>
            {r}
          </li>
        ))}
      </ul>
      <p className="text-xs font-medium italic" style={{ color }}>{risk.advice}</p>
    </div>
  );
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [entryLimit, setEntryLimit] = useState(15);
  const [profile, setProfile] = useState<{ name?: string; photo?: string } | null>(null);

  useEffect(() => {
    fetch("/api/profile").then(r => r.json()).then(d => { if (d) setProfile(d); });
  }, []);

  const flareRisk = computeFlareRisk(entries);

  const cutoff = subDays(new Date(), days).toISOString().split("T")[0];
  const filteredEntries = entries.filter((e) => e.date >= cutoff);
  const filteredChartData = chartData.filter((e) => e.date >= cutoff);

  // Entries for the selected week, or all in range
  const weekEntries = selectedDate
    ? (() => {
        const weekStart = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);
        const ws = weekStart.toISOString().split("T")[0];
        const we = weekEnd.toISOString().split("T")[0];
        return filteredEntries.filter((e) => e.date >= ws && e.date <= we);
      })()
    : filteredEntries;

  return (
    <div className="min-h-screen" style={{ color: "var(--text)", paddingBottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}>
      {/* Header */}
      <header className="px-4 pb-2 max-w-2xl mx-auto" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))" }}>
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
            <div className="flex-1 rounded-2xl px-3 py-3 text-center" style={{ background: "var(--stat-bg-indigo)", border: "1px solid var(--stat-border-indigo)" }}>
              <div className="text-xl font-bold text-indigo-500">{entries.length.toLocaleString()}</div>
              <div className="text-[10px] mt-0.5 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Days logged</div>
            </div>
            <div className="flex-1 rounded-2xl px-3 py-3 text-center" style={{ background: "var(--stat-bg-violet)", border: "1px solid var(--stat-border-violet)" }}>
              <div className="text-xl font-bold text-violet-500">{avgScore}</div>
              <div className="text-[10px] mt-0.5 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Avg mood</div>
            </div>
            <div className="flex-1 rounded-2xl px-3 py-3 text-center" style={{ background: "var(--stat-bg-orange)", border: "1px solid var(--stat-border-orange)" }}>
              <div className="text-xl font-bold text-orange-500">{streak} 🔥</div>
              <div className="text-[10px] mt-0.5 uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Day streak</div>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* TODAY TAB */}
        {tab === "Today" && (
          <>
            {flareRisk && <FlareWarning risk={flareRisk} />}
            {todayLogged ? (
              <div className="glass rounded-2xl p-6 text-center space-y-3">
                <div className="text-5xl">{MOOD_EMOJI[entries[0].mood]}</div>
                <div>
                  <p className="font-semibold capitalize text-lg" style={{ color: MOOD_COLORS[entries[0].mood] }}>{entries[0].mood}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Logged today</p>
                </div>
                {entries[0].activities && entries[0].activities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-center pt-1">
                    {entries[0].activities.map((a) => (
                      <span key={a} className="text-xs px-2.5 py-0.5 rounded-full" style={{ background: "var(--chip-bg)", border: "1px solid var(--chip-border)", color: "var(--text-dim)" }}>{a}</span>
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
                <RangePicker value={days} onChange={(r) => { setDays(r); setSelectedDate(null); setEntryLimit(15); }} />
              </div>
              <MoodChart
                data={filteredChartData}
                days={days}
                onSelectDate={setSelectedDate}
                selectedDate={selectedDate}
              />
              {days > 60 && (
                <p className="text-[10px] mt-2 text-center" style={{ color: "var(--text-muted)" }}>
                  Tap a point to filter entries by week
                </p>
              )}
            </section>

            <section className="glass rounded-2xl p-4">
              <div className="flex justify-between items-center mb-3">
                {selectedDate ? (
                  <>
                    <div>
                      <h2 className="font-semibold">Week of {format(parseISO(selectedDate), "MMM d")}</h2>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Scores shown are daily, not averaged</p>
                    </div>
                    <button
                      onClick={() => { setSelectedDate(null); setEntryLimit(15); }}
                      className="text-xs px-2.5 py-1 rounded-lg"
                      style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                    >
                      ✕ Clear
                    </button>
                  </>
                ) : (
                  <h2 className="font-semibold">Recent entries</h2>
                )}
              </div>
              {(() => {
                const visible = weekEntries.slice(0, selectedDate ? weekEntries.length : entryLimit);
                const hasMore = !selectedDate && weekEntries.length > entryLimit;
                return (
                  <>
                    <div className="space-y-0">
                      {visible.length === 0 ? (
                        <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>No entries for this period</p>
                      ) : visible.map((e, i) => (
                        <Link key={e.id} href={`/entries/${e.id}`} className={`flex items-start gap-3 py-3 -mx-1 px-1 rounded-xl transition-colors ${i < visible.length - 1 ? "border-b" : ""}`} style={{ borderColor: "var(--divider)" }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 mt-0.5" style={{ backgroundColor: MOOD_COLORS[e.mood] + "22" }}>
                            {MOOD_EMOJI[e.mood]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline gap-2">
                              <span className="text-sm font-medium capitalize" style={{ color: MOOD_COLORS[e.mood] }}>{e.mood}</span>
                              <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>{relativeDate(e.date)}</span>
                            </div>
                            {e.activities && e.activities.length > 0 && (
                              <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{e.activities.join(" · ")}</p>
                            )}
                            {e.note && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--text-dim)" }}>{e.note}</p>}
                          </div>
                        </Link>
                      ))}
                    </div>
                    {hasMore && (
                      <button
                        onClick={() => setEntryLimit(l => l + 20)}
                        className="w-full mt-3 py-2 text-xs rounded-xl transition-all"
                        style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                      >
                        Show more ({weekEntries.length - entryLimit} remaining)
                      </button>
                    )}
                  </>
                );
              })()}
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

        {/* SETTINGS TAB */}
        {tab === "Profile" && (
          <section className="glass rounded-2xl p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Settings</h2>
              <a href="/api/auth/signout" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Sign out</a>
            </div>
            <SettingsPanel onPhotoChange={(photo) => setProfile(p => ({ ...p, photo }))} />
          </section>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50" style={{ background: "var(--nav-bg)", borderTop: "1px solid var(--nav-border)", backdropFilter: "blur(20px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex max-w-2xl mx-auto">
          {TABS.map(({ id, emoji }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-all relative"
            >
              {tab === id && (
                <span className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full opacity-20" style={{ background: "radial-gradient(circle, var(--c-primary), transparent)" }} />
              )}
              <span className={`text-xl transition-all ${tab === id ? "scale-110" : "opacity-50"}`}>{emoji}</span>
              <span className="text-[10px] font-medium tracking-wide" style={{ color: tab === id ? "var(--c-primary)" : "var(--text-muted)" }}>{id}</span>
              {id === "Today" && !todayLogged && tab !== "Today" && (
                <span className="absolute top-2 right-[calc(50%-14px)] w-1.5 h-1.5 rounded-full" style={{ background: "var(--c-primary)" }} />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
