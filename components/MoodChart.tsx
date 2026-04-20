"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { format, parseISO } from "date-fns";
import { MOOD_COLORS, MOOD_EMOJI } from "@/lib/mood";

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
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm">
      <p className="text-zinc-400">{format(parseISO(d.date), "MMM d, yyyy")}</p>
      <p className="font-medium" style={{ color: MOOD_COLORS[d.mood] }}>
        {MOOD_EMOJI[d.mood]} {d.mood}
      </p>
    </div>
  );
}

export default function MoodChart({ data }: Props) {
  const chartData = [...data].reverse();

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => format(parseISO(d), "MMM d")}
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[1, 5]}
          ticks={[1, 2, 3, 4, 5]}
          tickFormatter={(v) => ["", "awful", "bad", "meh", "good", "rad"][v]}
          tick={{ fill: "#71717a", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="moodScore"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#6366f1" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
