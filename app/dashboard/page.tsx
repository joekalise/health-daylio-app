import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { moodEntries } from "@/db/schema";
import { desc } from "drizzle-orm";
import DashboardShell from "@/components/DashboardShell";
import { isToday, parseISO, differenceInCalendarDays } from "date-fns";

export const dynamic = "force-dynamic";

function calcStreak(entries: { date: string }[]): number {
  if (!entries.length) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mostRecent = parseISO(entries[0].date);
  // Streak is broken if most recent entry is more than 1 day ago
  if (differenceInCalendarDays(today, mostRecent) > 1) return 0;
  // Count consecutive days back from the most recent entry
  let streak = 0;
  let expected = new Date(mostRecent);
  expected.setHours(0, 0, 0, 0);
  for (const e of entries) {
    const d = parseISO(e.date);
    if (differenceInCalendarDays(expected, d) === 0) {
      streak++;
      expected.setDate(expected.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/api/auth/signin");

  const entries = await db
    .select()
    .from(moodEntries)
    .orderBy(desc(moodEntries.date))
    .limit(3650);

  const chartData = entries.map((e) => ({
    date: e.date,
    moodScore: e.moodScore,
    mood: e.mood,
  }));

  const avgScore = entries.length
    ? (entries.reduce((s, e) => s + e.moodScore, 0) / entries.length).toFixed(1)
    : "—";

  const todayLogged = entries.length > 0 && isToday(parseISO(entries[0].date));
  const streak = calcStreak(entries);

  return (
    <DashboardShell
      entries={entries}
      chartData={chartData}
      avgScore={avgScore}
      streak={streak}
      todayLogged={todayLogged}
    />
  );
}
