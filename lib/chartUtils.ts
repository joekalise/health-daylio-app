import { startOfWeek, parseISO } from "date-fns";

export function smoothByWeek<T extends { date: string }>(
  data: T[],
  days: number,
  aggregator: (items: T[]) => Omit<T, "date">
): T[] {
  if (days <= 60) return data;
  const weeks: Record<string, T[]> = {};
  for (const d of data) {
    const key = startOfWeek(parseISO(d.date), { weekStartsOn: 1 }).toISOString().split("T")[0];
    if (!weeks[key]) weeks[key] = [];
    weeks[key].push(d);
  }
  return Object.entries(weeks)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, ...aggregator(items) } as T));
}

export function dateTickFormat(days: number) {
  return days <= 60 ? "MMM d" : days <= 365 ? "MMM" : "MMM yy";
}
