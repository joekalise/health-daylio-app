"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format, parseISO } from "date-fns";
import { MOOD_COLORS, MOOD_EMOJI } from "@/lib/mood";
import { useChartTheme } from "@/lib/chartTheme";

interface DataPoint {
  date: string;
  moodScore: number;
  mood: string;
}

interface Props {
  data: DataPoint[];
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: DataPoint }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ backgroundColor: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: 10, padding: "8px 12px" }}>
      <p style={{ color: "var(--text-dim)", fontSize: 12 }}>{format(parseISO(d.date), "MMM d, yyyy")}</p>
      <p className="font-medium text-sm" style={{ color: MOOD_COLORS[d.mood] }}>
        {MOOD_EMOJI[d.mood]} {d.mood}
      </p>
    </div>
  );
}

export default function MoodChart({ data }: Props) {
  const theme = useChartTheme();
  const chartData = [...data].reverse();

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => format(parseISO(d), "MMM d")}
          tick={theme.tick}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[1, 5]}
          ticks={[1, 2, 3, 4, 5]}
          tickFormatter={(v) => ["", "awful", "bad", "meh", "good", "rad"][v]}
          tick={{ ...theme.tick, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="moodScore"
          stroke="#6366f1"
          strokeWidth={2.5}
          fill="url(#moodFill)"
          dot={false}
          activeDot={{ r: 4, fill: "#6366f1", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
