"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";

interface Account {
  id: number;
  name: string;
  type: string;
  currency: string;
  displayOrder: number;
}

interface BalanceData {
  accounts: Account[];
  latestByAccount: Record<number, number>;
  history: { date: string; netWorth: number }[];
}

const tooltipStyle = { backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 };
const tickStyle = { fill: "#71717a", fontSize: 11 };

const TYPE_LABELS: Record<string, string> = {
  current: "Current Accounts",
  savings: "Savings",
  investment: "Investments",
  pension: "Pension / Retirement",
};

const TYPE_COLORS: Record<string, string> = {
  current: "#6366f1",
  savings: "#22c55e",
  investment: "#f97316",
  pension: "#8b5cf6",
};

const EUR = (v: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

function StatCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="bg-zinc-800 rounded-2xl p-4 text-center">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color: color ?? "#fff" }}>{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function FinanceSection() {
  const [data, setData] = useState<BalanceData | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftBalances, setDraftBalances] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: "", type: "current", currency: "EUR" });
  const [loading, setLoading] = useState(true);

  async function load() {
    const r = await fetch("/api/finance/balances");
    const d = await r.json();
    setData(d);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startEditing() {
    if (!data) return;
    const draft: Record<number, string> = {};
    for (const acc of data.accounts) {
      draft[acc.id] = data.latestByAccount[acc.id]?.toString() ?? "";
    }
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
    const today = new Date().toISOString().split("T")[0];
    await fetch("/api/finance/balances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balances, date: today }),
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
      body: JSON.stringify({ ...newAccount, displayOrder: (data?.accounts.length ?? 0) + 1 }),
    });
    setNewAccount({ name: "", type: "current", currency: "EUR" });
    setAddingAccount(false);
    await load();
  }

  if (loading) return <p className="text-zinc-500 text-sm text-center py-8">Loading finances...</p>;
  if (!data) return null;

  const { accounts, latestByAccount, history } = data;

  // Group accounts by type
  const grouped: Record<string, Account[]> = {};
  for (const acc of accounts) {
    if (!grouped[acc.type]) grouped[acc.type] = [];
    grouped[acc.type].push(acc);
  }

  const netWorth = accounts.reduce((s, a) => s + (latestByAccount[a.id] ?? 0), 0);

  const byType: Record<string, number> = {};
  for (const acc of accounts) {
    byType[acc.type] = (byType[acc.type] ?? 0) + (latestByAccount[acc.id] ?? 0);
  }

  const hasHistory = history.length > 1;

  return (
    <div className="space-y-6">
      {/* Net worth hero */}
      <div className="text-center py-2">
        <div className="text-xs text-zinc-500 mb-1">Net Worth</div>
        <div className="text-4xl font-bold text-white">{EUR(netWorth)}</div>
        {history.length > 1 && (() => {
          const prev = history[history.length - 2]?.netWorth ?? 0;
          const delta = netWorth - prev;
          return (
            <div className={`text-sm mt-1 ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {delta >= 0 ? "↑" : "↓"} {EUR(Math.abs(delta))} since last snapshot
            </div>
          );
        })()}
      </div>

      {/* Summary by type */}
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(TYPE_LABELS).filter(([type]) => grouped[type]).map(([type, label]) => (
          <StatCard key={type} label={label} value={EUR(byType[type] ?? 0)} color={TYPE_COLORS[type]} />
        ))}
      </div>

      {/* Net worth history chart */}
      {hasHistory && (
        <div>
          <h3 className="text-xs font-medium text-zinc-400 mb-2">Net worth over time</h3>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tickFormatter={(d) => format(parseISO(d), "MMM yy")} tick={tickStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => format(parseISO(d as string), "MMM d, yyyy")} formatter={(v) => [EUR(Number(v)), "Net Worth"]} />
              <Line type="monotone" dataKey="netWorth" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Account balances */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-medium text-zinc-400">Balances</h3>
          {!editing ? (
            <button onClick={startEditing} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Update balances
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
              <button onClick={saveSnapshot} disabled={saving} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg transition-colors disabled:opacity-50">
                {saving ? "Saving..." : "Save snapshot"}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {Object.entries(TYPE_LABELS).filter(([type]) => grouped[type]).map(([type, label]) => (
            <div key={type}>
              <p className="text-xs text-zinc-600 mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: TYPE_COLORS[type] }} />
                {label}
              </p>
              <div className="space-y-1">
                {grouped[type].map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                    <span className="text-sm text-zinc-300">{acc.name}</span>
                    {editing ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-zinc-600">{acc.currency}</span>
                        <input
                          type="number"
                          value={draftBalances[acc.id] ?? ""}
                          onChange={(e) => setDraftBalances((p) => ({ ...p, [acc.id]: e.target.value }))}
                          className="w-28 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1 text-sm text-right text-white focus:outline-none focus:border-indigo-500"
                          placeholder="0.00"
                          step="0.01"
                        />
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-white">
                        {latestByAccount[acc.id] != null ? EUR(latestByAccount[acc.id]) : <span className="text-zinc-600">—</span>}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Add account */}
        {editing && (
          <div className="mt-4">
            {!addingAccount ? (
              <button onClick={() => setAddingAccount(true)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                + Add account
              </button>
            ) : (
              <div className="bg-zinc-800 rounded-xl p-3 space-y-2 mt-2">
                <input
                  type="text"
                  placeholder="Account name"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount((p) => ({ ...p, name: e.target.value }))}
                  className="w-full bg-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                />
                <div className="flex gap-2">
                  <select
                    value={newAccount.type}
                    onChange={(e) => setNewAccount((p) => ({ ...p, type: e.target.value }))}
                    className="flex-1 bg-zinc-700 rounded-lg px-2 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="current">Current</option>
                    <option value="savings">Savings</option>
                    <option value="investment">Investment</option>
                    <option value="pension">Pension</option>
                  </select>
                  <select
                    value={newAccount.currency}
                    onChange={(e) => setNewAccount((p) => ({ ...p, currency: e.target.value }))}
                    className="w-20 bg-zinc-700 rounded-lg px-2 py-2 text-sm text-white focus:outline-none"
                  >
                    <option>EUR</option>
                    <option>GBP</option>
                    <option>USD</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAddingAccount(false)} className="flex-1 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
                  <button onClick={addAccount} className="flex-1 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">Add</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!hasHistory && (
        <p className="text-xs text-zinc-600 text-center">Save your first snapshot to start tracking net worth over time.</p>
      )}
    </div>
  );
}
