"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { MOOD_COLORS } from "@/lib/mood";
import { useChartTheme } from "@/lib/chartTheme";

interface DataPoint {
  date: string;
  moodScore: number;
  mood: string;
}

interface Props {
  data: DataPoint[];
  days: number;
  onSelectDate?: (date: string | null) => void;
  selectedDate?: string | null;
}

// Adaptive bucketing: daily → weekly → biweekly → monthly
function bucketData(data: DataPoint[], days: number): DataPoint[] {
  if (days <= 60) return data;

  const buckets: Record<string, DataPoint[]> = {};
  for (const d of data) {
    let key: string;
    if (days > 365) {
      key = startOfMonth(parseISO(d.date)).toISOString().split("T")[0];
    } else if (days > 180) {
      // biweekly: snap to nearest fortnight starting from a fixed Monday
      const parsed = parseISO(d.date);
      const weekStart = startOfWeek(parsed, { weekStartsOn: 1 });
      const weekNum = Math.floor(
        (weekStart.getTime() - new Date("2020-01-06").getTime()) / (14 * 86400000)
      );
      const twoWeekStart = new Date(new Date("2020-01-06").getTime() + weekNum * 14 * 86400000);
      key = twoWeekStart.toISOString().split("T")[0];
    } else {
      key = startOfWeek(parseISO(d.date), { weekStartsOn: 1 }).toISOString().split("T")[0];
    }
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(d);
  }

  const bucketed = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      moodScore: +(items.reduce((s, i) => s + i.moodScore, 0) / items.length).toFixed(2),
      mood: items.sort((a, b) => b.moodScore - a.moodScore)[Math.floor(items.length / 2)].mood,
    }));

  // Rolling average — window size scales with number of buckets
  const window = days > 365 ? 2 : 2;
  return bucketed.map((w, i) => {
    const slice = bucketed.slice(Math.max(0, i - window), Math.min(bucketed.length, i + window + 1));
    return {
      ...w,
      moodScore: +(slice.reduce((s, e) => s + e.moodScore, 0) / slice.length).toFixed(2),
    };
  });
}

function tickFmt(days: number) {
  if (days <= 60) return "MMM d";
  if (days <= 365) return "MMM";
  return "MMM yy";
}

function CustomTooltip({
  active, payload, days,
}: {
  active?: boolean;
  payload?: { payload: DataPoint }[];
  days: number;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const score = d.moodScore;
  const label = score >= 4.5 ? "rad" : score >= 3.5 ? "good" : score >= 2.5 ? "meh" : score >= 1.5 ? "bad" : "awful";
  const color = MOOD_COLORS[label] ?? "#6366f1";
  const isSmoothed = days > 60;
  const dateLabel = isSmoothed
    ? days > 365
      ? `Month of ${format(parseISO(d.date), "MMM yyyy")}`
      : days > 180
        ? `Fortnight of ${format(parseISO(d.date), "MMM d")}`
        : `Week of ${format(parseISO(d.date), "MMM d")}`
    : format(parseISO(d.date), "MMM d, yyyy");

  return (
    <div style={{ backgroundColor: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: 10, padding: "8px 12px" }}>
      <p style={{ color: "var(--text-muted)", fontSize: 11 }}>{dateLabel}</p>
      <p className="font-semibold text-sm mt-0.5" style={{ color }}>
        {isSmoothed ? `avg ${score.toFixed(1)} / 5` : `${label} (${score})`}
      </p>
    </div>
  );
}

export default function MoodChart({ data, days, onSelectDate, selectedDate }: Props) {
  const theme = useChartTheme();
  const isSmoothed = days > 60;
  const chartData = bucketData([...data].reverse(), days);
  const fmt = tickFmt(days);

  const overallAvg = chartData.length
    ? chartData.reduce((s, d) => s + d.moodScore, 0) / chartData.length
    : null;

  // Opacity of fill: lower for longer views to avoid barcode effect
  const fillOpacity = days > 365 ? 0.2 : days > 180 ? 0.25 : 0.3;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart
        data={chartData}
        margin={{ top: 4, right: 8, bottom: 0, left: isSmoothed ? -8 : 4 }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onClick={(e: any) => {
          if (!onSelectDate) return;
          const date = e?.activePayload?.[0]?.payload?.date ?? null;
          onSelectDate(selectedDate === date ? null : date);
        }}
        style={{ cursor: onSelectDate ? "pointer" : undefined }}
      >
        <defs>
          <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={fillOpacity} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
        {overallAvg && (
          <ReferenceLine
            y={overallAvg}
            stroke="#6366f1"
            strokeDasharray="4 4"
            strokeOpacity={0.35}
          />
        )}
        <XAxis
          dataKey="date"
          tickFormatter={(d) => format(parseISO(d), fmt)}
          tick={theme.tick}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={48}
        />
        {isSmoothed ? (
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ ...theme.tick, fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            width={16}
            tickFormatter={(v) => String(v)}
          />
        ) : (
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tickFormatter={(v) => ["", "awful", "bad", "meh", "good", "rad"][v]}
            tick={{ ...theme.tick, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
        )}
        <Tooltip content={<CustomTooltip days={days} />} />
        <Area
          type={isSmoothed ? "basis" : "monotone"}
          dataKey="moodScore"
          stroke="#6366f1"
          strokeWidth={isSmoothed ? 2 : 2.5}
          fill="url(#moodFill)"
          dot={false}
          activeDot={{ r: 4, fill: "#6366f1", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
