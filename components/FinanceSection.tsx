"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { format, parseISO } from "date-fns";

interface Entry {
  id: number;
  category: string;
  name: string;
  value: number;
  currency: string;
  metadata: Record<string, any> | null;
}

const tooltipStyle = { backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 };

const EUR = (v: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

const EXPENSE_COLORS = ["#6366f1","#8b5cf6","#a78bfa","#c4b5fd","#e879f9","#f472b6","#fb7185","#f97316","#facc15","#4ade80","#34d399","#22d3ee"];

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-zinc-800 rounded-xl p-3 text-center">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="font-bold text-lg" style={{ color: color ?? "#fff" }}>{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function FinanceSection() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [importedAt, setImportedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/finance")
      .then((r) => r.json())
      .then((d) => { setEntries(d.entries ?? []); setImportedAt(d.importedAt); setLoading(false); });
  }, []);

  if (loading) return <p className="text-zinc-500 text-sm">Loading finance data...</p>;
  if (!entries.length) return <p className="text-zinc-500 text-sm">No finance data. Run the import script.</p>;

  const income = entries.filter((e) => e.category === "income");
  const expenses = entries.filter((e) => e.category === "expense");
  const balances = entries.filter((e) => e.category === "balance");
  const goals = entries.filter((e) => e.category === "savings_goal");
  const investments = entries.filter((e) => e.category === "investment");

  const totalIncome = income.reduce((s, e) => s + e.value, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.value, 0);
  const surplus = totalIncome - totalExpenses;

  const totalCurrent = balances.reduce((s, e) => s + e.value, 0);
  const totalInvestments = investments.reduce((s, e) => s + e.value, 0);
  const totalSavings = goals.reduce((s, e) => s + e.value, 0);
  const netWorth = totalCurrent + totalInvestments + totalSavings;

  // Group expenses for pie chart
  const expenseGroups: Record<string, number> = {};
  for (const e of expenses) {
    const group = (e.metadata as any)?.group || "Other";
    expenseGroups[group] = (expenseGroups[group] ?? 0) + e.value;
  }
  const pieData = Object.entries(expenseGroups)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Math.round(value) }));

  // Group balances
  const balanceGroups: Record<string, Entry[]> = {};
  for (const e of balances) {
    const g = (e.metadata as any)?.group || "Other";
    if (!balanceGroups[g]) balanceGroups[g] = [];
    balanceGroups[g].push(e);
  }

  return (
    <div className="space-y-6">
      {importedAt && (
        <p className="text-xs text-zinc-600 text-right">
          Last updated {format(new Date(importedAt), "MMM d, yyyy")}
        </p>
      )}

      {/* Net worth + budget summary */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Net Worth" value={EUR(netWorth)} color="#22c55e" />
        <StatCard label="Monthly Surplus" value={EUR(surplus)} color={surplus >= 0 ? "#22c55e" : "#ef4444"} />
        <StatCard label="Monthly Income" value={EUR(totalIncome)} color="#6366f1" />
        <StatCard label="Monthly Expenses" value={EUR(totalExpenses)} color="#f97316" />
      </div>

      {/* Expense breakdown pie */}
      <div>
        <h3 className="text-xs font-medium text-zinc-400 mb-3">Expense breakdown</h3>
        <div className="flex gap-4 items-center">
          <ResponsiveContainer width={120} height={120}>
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={55} strokeWidth={0}>
                {pieData.map((_, i) => <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [EUR(Number(v)), ""]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-1.5 min-w-0">
            {pieData.map(({ name, value }, i) => (
              <div key={name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                <span className="text-xs text-zinc-300 truncate flex-1">{name}</span>
                <span className="text-xs text-zinc-500">{EUR(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top expenses */}
      <div>
        <h3 className="text-xs font-medium text-zinc-400 mb-3">Monthly expenses</h3>
        <div className="space-y-1.5">
          {expenses.sort((a, b) => b.value - a.value).slice(0, 12).map((e) => (
            <div key={e.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-300 truncate">{e.name}</div>
                <div className="text-xs text-zinc-600">{(e.metadata as any)?.group}</div>
              </div>
              <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(e.value / totalExpenses) * 100}%` }} />
              </div>
              <div className="text-xs text-zinc-400 w-16 text-right">{EUR(e.value)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Account balances */}
      <div>
        <h3 className="text-xs font-medium text-zinc-400 mb-3">Account balances</h3>
        <div className="space-y-3">
          {Object.entries(balanceGroups).map(([group, accs]) => (
            <div key={group}>
              <p className="text-xs text-zinc-600 mb-1.5">{group}</p>
              {accs.map((a) => (
                <div key={a.id} className="flex justify-between items-center py-1.5 border-b border-zinc-800 last:border-0">
                  <span className="text-sm text-zinc-300">{a.name}</span>
                  <span className="text-sm font-medium text-white">{EUR(a.value)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Investments */}
      {investments.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-zinc-400 mb-3">Investments · {EUR(totalInvestments)}</h3>
          {investments.map((inv) => (
            <div key={inv.id} className="flex justify-between items-center py-1.5 border-b border-zinc-800 last:border-0">
              <span className="text-sm text-zinc-300">{inv.name}</span>
              <span className="text-sm font-medium text-white">{EUR(inv.value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Savings goals */}
      {goals.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-zinc-400 mb-3">Savings goals</h3>
          <div className="space-y-3">
            {goals.map((g) => {
              const meta = g.metadata as any;
              const pct = Math.min((g.value / (meta?.goalAmount ?? 1)) * 100, 100);
              return (
                <div key={g.id}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-zinc-300">{g.name}</span>
                    <span className="text-xs text-zinc-500">{EUR(g.value)} / {EUR(meta?.goalAmount ?? 0)}</span>
                  </div>
                  <div className="bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-zinc-600 mt-0.5">{pct.toFixed(1)}% complete</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
