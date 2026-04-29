"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { format, parseISO, startOfWeek } from "date-fns";
import { useChartTheme } from "@/lib/chartTheme";

interface Account { id: number; name: string; type: string; currency: string; displayOrder: number; isNetWorth: boolean; }
interface BudgetEntry { id: number; category: string; name: string; value: number; metadata: Record<string, any> | null; }
interface BalanceData {
  accounts: Account[];
  latestByAccount: Record<number, number>;
  history: { date: string; netWorth: number }[];
}

const TYPE_COLORS: Record<string, string> = {
  current: "#6366f1", savings: "#22c55e", investment: "#f97316", pension: "#8b5cf6",
};
const TYPE_LABELS: Record<string, string> = {
  current: "Current", savings: "Savings", investment: "Investments", pension: "Pension",
};
const PIE_COLORS = ["#6366f1","#8b5cf6","#a78bfa","#ec4899","#f97316","#facc15","#4ade80","#22d3ee","#f472b6","#fb7185"];

const EUR = (v: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

function pct(v: number) { return v.toFixed(1) + "%"; }

function yearsToFIRE(current: number, monthlyContrib: number, target: number, annualReturn = 0.07): number | null {
  if (current >= target) return 0;
  if (monthlyContrib <= 0) return null;
  const r = annualReturn / 12;
  let bal = current;
  for (let m = 1; m <= 600; m++) {
    bal = bal * (1 + r) + monthlyContrib;
    if (bal >= target) return +(m / 12).toFixed(1);
  }
  return null;
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl p-3 text-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
      <div className="text-xs mb-0.5" style={{ color: `${color}99` }}>{label}</div>
      <div className="font-bold text-base" style={{ color: "var(--text)" }}>{value}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: `${color}70` }}>{sub}</div>}
    </div>
  );
}

function smoothNetWorth(data: { date: string; netWorth: number }[]) {
  if (data.length <= 10) return data;
  const weeks: Record<string, { total: number; count: number }> = {};
  for (const d of data) {
    const key = startOfWeek(parseISO(d.date), { weekStartsOn: 1 }).toISOString().split("T")[0];
    if (!weeks[key]) weeks[key] = { total: 0, count: 0 };
    weeks[key].total += d.netWorth;
    weeks[key].count++;
  }
  return Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).map(([date, { total, count }]) => ({ date, netWorth: total / count }));
}

export default function FinanceSection() {
  const theme = useChartTheme();
  const [balData, setBalData] = useState<BalanceData | null>(null);
  const [budgetEntries, setBudgetEntries] = useState<BudgetEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [draftBalances, setDraftBalances] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: "", type: "current", currency: "EUR" });
  const [loading, setLoading] = useState(true);
  const [fireSettings, setFireSettings] = useState({ multiplier: 25, annualReturn: 7, retireAge: null as number | null });

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("fire_settings") ?? "{}");
      setFireSettings({
        multiplier: s.multiplier ?? 25,
        annualReturn: s.annualReturn ?? 7,
        retireAge: s.retireAge ?? null,
      });
    } catch {}
  }, []);

  async function load() {
    const [b, f] = await Promise.all([
      fetch("/api/finance/balances").then(r => r.json()),
      fetch("/api/finance").then(r => r.json()),
    ]);
    setBalData(b);
    setBudgetEntries(f.entries ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startEditing() {
    if (!balData) return;
    const draft: Record<number, string> = {};
    for (const acc of balData.accounts) draft[acc.id] = balData.latestByAccount[acc.id]?.toString() ?? "";
    setDraftBalances(draft);
    setEditing(true);
  }

  async function saveSnapshot() {
    setSaving(true);
    const balances: Record<number, number> = {};
    for (const [id, val] of Object.entries(draftBalances)) {
      const n = parseFloat(val);
      if (!isNaN(n)) balances[Number(id)] = n;
    }
    await fetch("/api/finance/balances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balances, date: new Date().toISOString().split("T")[0] }),
    });
    await load();
    setEditing(false);
    setSaving(false);
  }

  async function addAccount() {
    if (!newAccount.name.trim()) return;
    await fetch("/api/finance/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newAccount, displayOrder: (balData?.accounts.length ?? 0) + 1 }),
    });
    setNewAccount({ name: "", type: "current", currency: "EUR" });
    setAddingAccount(false);
    await load();
  }

  if (loading) return <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>Loading...</p>;
  if (!balData) return null;

  const { accounts, latestByAccount, history } = balData;
  const income = budgetEntries.filter(e => e.category === "income");
  const allExpenses = budgetEntries.filter(e => e.category === "expense");
  const expenses = allExpenses.filter(e => (e.metadata as any)?.type !== "S");
  const savingsItems = allExpenses.filter(e => (e.metadata as any)?.type === "S");

  const monthlyIncome = income.reduce((s, e) => s + e.value, 0);
  const monthlyExpenses = expenses.reduce((s, e) => s + e.value, 0);
  const monthlySavingsAllocated = savingsItems.reduce((s, e) => s + e.value, 0);
  const monthlySurplus = monthlyIncome - monthlyExpenses - monthlySavingsAllocated;
  const savingsRate = monthlyIncome > 0 ? (monthlySavingsAllocated / monthlyIncome) * 100 : 0;

  // Net worth from net-worth accounts only
  const netWorthAccounts = accounts.filter(a => a.isNetWorth);
  const netWorth = netWorthAccounts.reduce((s, a) => s + (latestByAccount[a.id] ?? 0), 0);
  const byType: Record<string, number> = {};
  for (const acc of netWorthAccounts) byType[acc.type] = (byType[acc.type] ?? 0) + (latestByAccount[acc.id] ?? 0);

  // Expense groups for pie
  const expenseGroups: Record<string, number> = {};
  for (const e of expenses) {
    const g = (e.metadata as any)?.group || "Other";
    expenseGroups[g] = (expenseGroups[g] ?? 0) + e.value;
  }
  const pieData = Object.entries(expenseGroups).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value: Math.round(value) }));

  // FIRE
  const annualExpenses = monthlyExpenses * 12;
  const fireTarget = annualExpenses * fireSettings.multiplier;
  const currentInvested = (byType.investment ?? 0) + (byType.pension ?? 0);
  const monthlyInvestment = Math.max(0, monthlySavingsAllocated);
  const yearsLeft = yearsToFIRE(currentInvested, monthlyInvestment, fireTarget, fireSettings.annualReturn / 100);
  const firePct = fireTarget > 0 ? Math.min((currentInvested / fireTarget) * 100, 100) : 0;

  // Budget breakdown bar data
  const budgetBarData = [
    { label: "Income", value: monthlyIncome, color: "#22c55e" },
    { label: "Expenses", value: monthlyExpenses, color: "#f97316" },
    { label: "Surplus", value: Math.max(0, monthlySurplus), color: "#6366f1" },
  ];

  // Group accounts by type
  const grouped: Record<string, Account[]> = {};
  for (const acc of accounts) {
    if (!grouped[acc.type]) grouped[acc.type] = [];
    grouped[acc.type].push(acc);
  }

  const hasHistory = history.length > 1;

  return (
    <div className="space-y-4">
      {/* Net worth hero */}
      <GlassCard className="text-center py-5">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Net Worth</p>
        <p className="text-4xl font-bold grad-text">{EUR(netWorth)}</p>
        {hasHistory && (() => {
          const prev = history[history.length - 2]?.netWorth ?? 0;
          const delta = netWorth - prev;
          return (
            <p className={`text-sm mt-2 ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {delta >= 0 ? "↑" : "↓"} {EUR(Math.abs(delta))} since last snapshot
            </p>
          );
        })()}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {Object.entries(TYPE_LABELS).filter(([t]) => byType[t] !== undefined).map(([type, label]) => (
            <div key={type} className="rounded-xl p-2 text-center" style={{ background: `${TYPE_COLORS[type]}15`, border: `1px solid ${TYPE_COLORS[type]}25` }}>
              <div className="text-xs font-medium" style={{ color: "var(--text)" }}>{EUR(byType[type] ?? 0)}</div>
              <div className="text-[10px] mt-0.5" style={{ color: `${TYPE_COLORS[type]}99` }}>{label}</div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Net worth history */}
      {hasHistory && (
        <GlassCard>
          <h3 className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Net Worth History</h3>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={smoothNetWorth(history)} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => format(parseISO(d), history.length > 180 ? "MMM yy" : "MMM")} tick={theme.tick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={theme.tick} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={theme.tooltip} labelFormatter={(d) => format(parseISO(d as string), "MMM d, yyyy")} formatter={(v) => [EUR(Number(v)), "Net Worth"]} />
              <Area type="monotone" dataKey="netWorth" stroke="#22c55e" strokeWidth={2.5} fill="url(#nwGrad)" dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      {/* Budget overview */}
      {monthlyIncome > 0 && (
        <GlassCard>
          <h3 className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Monthly Budget</h3>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <StatCard label="Income" value={EUR(monthlyIncome)} color="#22c55e" />
            <StatCard label="Expenses" value={EUR(monthlyExpenses)} color="#f97316" />
            <StatCard label="Savings & Investments" value={EUR(monthlySavingsAllocated)} color="#8b5cf6" />
            <StatCard label="Unallocated" value={EUR(monthlySurplus)} color={monthlySurplus >= 0 ? "#6366f1" : "#ef4444"} />
          </div>
          {/* Savings rate */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span style={{ color: "var(--text-muted)" }}>Savings rate</span>
              <span className="font-medium" style={{ color: "var(--text)" }}>{pct(savingsRate)}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--divider)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(savingsRate, 100))}%`, background: "linear-gradient(90deg, #8b5cf6, #6366f1)" }} />
            </div>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
              {savingsRate >= 30 ? "Excellent savings rate!" : savingsRate >= 20 ? "Great savings rate!" : savingsRate >= 10 ? "Good — aim for 20%+" : "Try to save more each month"}
            </p>
          </div>
          {/* Savings breakdown */}
          {savingsItems.length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--divider)" }}>
              <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Savings breakdown</p>
              {savingsItems.map(e => (
                <div key={e.id} className="flex justify-between text-xs py-1">
                  <span style={{ color: "var(--text-dim)" }}>{e.name}</span>
                  <span style={{ color: "var(--text)" }}>{EUR(e.value)}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {/* Expense breakdown */}
      {pieData.length > 0 && (
        <GlassCard>
          <h3 className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Expense Breakdown</h3>
          <div className="flex gap-4 items-center">
            <ResponsiveContainer width={110} height={110}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={50} strokeWidth={0}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={theme.tooltip} formatter={(v) => [EUR(Number(v)), ""]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5 min-w-0">
              {pieData.slice(0, 6).map(({ name, value }, i) => (
                <div key={name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-xs truncate flex-1" style={{ color: "var(--text-dim)" }}>{name}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{EUR(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      )}

      {/* FIRE Progress */}
      {fireTarget > 0 && (
        <GlassCard>
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>FIRE Progress</h3>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Financial Independence / Retire Early</p>
            </div>
            {yearsLeft !== null && (
              <div className="text-right">
                <span className="text-lg font-bold text-violet-300">{yearsLeft}y</span>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {fireSettings.retireAge ? `retire at ${fireSettings.retireAge}` : "to go"}
                </p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: "var(--text-muted)" }}>Current invested</span>
              <span style={{ color: "var(--text)" }}>{EUR(currentInvested)}</span>
            </div>
            <div className="flex justify-between text-xs mb-2">
              <span style={{ color: "var(--text-muted)" }}>FIRE target (25× expenses)</span>
              <span style={{ color: "var(--text)" }}>{EUR(fireTarget)}</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--divider)" }}>
              <div
                className="h-full rounded-full transition-all relative overflow-hidden"
                style={{ width: `${firePct}%`, background: "linear-gradient(90deg, #8b5cf6, #6366f1)" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
              </div>
            </div>
            <div className="flex justify-between text-[10px]" style={{ color: "var(--text-muted)" }}>
              <span>{pct(firePct)} there</span>
              <span>{EUR(fireTarget - currentInvested)} remaining</span>
            </div>
          </div>
          {/* Projection chart */}
          {yearsLeft !== null && (() => {
            const projData: { year: number; balance: number }[] = [];
            const r = 0.07 / 12;
            let bal = currentInvested;
            for (let m = 0; m <= Math.ceil(yearsLeft * 12); m += 6) {
              projData.push({ year: +(m / 12).toFixed(1), balance: bal });
              for (let i = 0; i < 6; i++) bal = bal * (1 + r) + monthlyInvestment;
            }
            projData.push({ year: yearsLeft, balance: fireTarget });
            return (
              <div className="mt-3">
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={projData} margin={{ top: 2, right: 4, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                    <XAxis dataKey="year" tick={theme.tick} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}y`} />
                    <YAxis tick={theme.tick} tickLine={false} axisLine={false} width={45} tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={theme.tooltip} formatter={(v) => [EUR(Number(v)), "Balance"]} labelFormatter={(v) => `Year ${v}`} />
                    <Line type="monotone" dataKey="balance" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </GlassCard>
      )}

      {/* Account balances */}
      <GlassCard>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Account Balances</h3>
          {!editing ? (
            <button onClick={startEditing} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all" style={{ background: "var(--c-primary-dim)", border: "1px solid var(--c-primary-border)", color: "var(--c-primary)" }}>Update</button>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => setEditing(false)} className="text-xs" style={{ color: "var(--text-muted)" }}>Cancel</button>
              <button onClick={saveSnapshot} disabled={saving} className="text-xs bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 px-3 py-1 rounded-lg transition-colors disabled:opacity-50">
                {saving ? "Saving..." : "Save snapshot"}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {(["current","savings","investment","pension"] as const).filter(t => grouped[t]).map((type) => (
            <div key={type}>
              <p className="text-[10px] uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: `${TYPE_COLORS[type]}80` }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: TYPE_COLORS[type] }} />
                {TYPE_LABELS[type]}
              </p>
              {grouped[type].map((acc) => (
                <div key={acc.id} className={`flex items-center justify-between py-2 last:border-0 ${!acc.isNetWorth ? "opacity-50" : ""}`} style={{ borderBottom: "1px solid var(--divider)" }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm truncate" style={{ color: "var(--text-dim)" }}>{acc.name}</span>
                    {!acc.isNetWorth && <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>excl.</span>}
                  </div>
                  {editing ? (
                    <input
                      type="number"
                      value={draftBalances[acc.id] ?? ""}
                      onChange={(e) => setDraftBalances(p => ({ ...p, [acc.id]: e.target.value }))}
                      className="w-28 glass rounded-lg px-2.5 py-1 text-sm text-right focus:outline-none flex-shrink-0"
                      style={{ color: "var(--text)" }}
                      placeholder="0.00"
                      step="0.01"
                    />
                  ) : (
                    <span className="text-sm font-medium flex-shrink-0" style={{ color: "var(--text)" }}>
                      {latestByAccount[acc.id] != null ? EUR(latestByAccount[acc.id]) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {editing && (
          <div className="mt-4">
            {!addingAccount ? (
              <button onClick={() => setAddingAccount(true)} className="text-xs transition-colors" style={{ color: "var(--text-muted)" }}>+ Add account</button>
            ) : (
              <div className="glass rounded-xl p-3 space-y-2 mt-2">
                <input type="text" placeholder="Account name" value={newAccount.name} onChange={e => setNewAccount(p => ({ ...p, name: e.target.value }))} className="w-full glass rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ color: "var(--text)" }} />
                <div className="flex gap-2">
                  <select value={newAccount.type} onChange={e => setNewAccount(p => ({ ...p, type: e.target.value }))} className="flex-1 glass rounded-lg px-2 py-2 text-sm focus:outline-none" style={{ color: "var(--text)" }}>
                    <option value="current">Current</option>
                    <option value="savings">Savings</option>
                    <option value="investment">Investment</option>
                    <option value="pension">Pension</option>
                  </select>
                  <select value={newAccount.currency} onChange={e => setNewAccount(p => ({ ...p, currency: e.target.value }))} className="w-20 glass rounded-lg px-2 py-2 text-sm focus:outline-none" style={{ color: "var(--text)" }}>
                    <option>EUR</option><option>GBP</option><option>USD</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAddingAccount(false)} className="flex-1 py-1.5 text-xs" style={{ color: "var(--text-muted)" }}>Cancel</button>
                  <button onClick={addAccount} className="flex-1 py-1.5 text-xs rounded-lg text-indigo-300" style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)" }}>Add</button>
                </div>
              </div>
            )}
          </div>
        )}

        {!hasHistory && !editing && (
          <p className="text-[10px] text-center mt-3" style={{ color: "var(--text-muted)" }}>Save your first snapshot to start tracking net worth over time.</p>
        )}
      </GlassCard>
    </div>
  );
}
