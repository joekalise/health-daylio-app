"use client";

interface Entry {
  activities: string[];
  moodScore: number;
}

interface Props {
  entries: Entry[];
}

export default function ActivityHeatmap({ entries }: Props) {
  const activityMoods: Record<string, { total: number; count: number }> = {};

  for (const entry of entries) {
    for (const activity of entry.activities) {
      if (!activityMoods[activity]) activityMoods[activity] = { total: 0, count: 0 };
      activityMoods[activity].total += entry.moodScore;
      activityMoods[activity].count += 1;
    }
  }

  const sorted = Object.entries(activityMoods)
    .filter(([, v]) => v.count >= 3)
    .map(([name, v]) => ({ name, avg: v.total / v.count, count: v.count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 15);

  if (!sorted.length) return <p className="text-zinc-500 text-sm">No data yet.</p>;

  return (
    <div className="space-y-2">
      {sorted.map(({ name, avg, count }) => (
        <div key={name} className="flex items-center gap-3">
          <div className="w-32 text-xs text-zinc-300 truncate">{name}</div>
          <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${((avg - 1) / 4) * 100}%` }}
            />
          </div>
          <div className="text-xs text-zinc-500 w-16 text-right">{avg.toFixed(1)} · {count}×</div>
        </div>
      ))}
    </div>
  );
}
