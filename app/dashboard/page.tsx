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
  let streak = 0;
  let expected = new Date();
  expected.setHours(0, 0, 0, 0);
  for (const e of entries) {
    const d = parseISO(e.date);
    const diff = differenceInCalendarDays(expected, d);
    if (diff === 0) { streak++; expected.setDate(expected.getDate() - 1); }
    else if (diff === 1 && streak === 0) { expected.setDate(expected.getDate() - 1); continue; }
    else break;
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

  const chartData = entries.slice(0, 90).map((e) => ({
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
