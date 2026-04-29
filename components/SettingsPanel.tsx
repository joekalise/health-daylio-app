"use client";

import { useState, useEffect } from "react";
import ProfileSection from "./ProfileSection";

type Tab = "profile" | "budget" | "fire";

// ── Budget tab ────────────────────────────────────────────────────────────────
interface Entry { id: number; category: string; name: string; value: number; metadata: Record<string, any> | null; }

const EUR = (v: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

const GROUP_ORDER = ["Housing Bills", "Personal Bills", "Debt, Savings & Investments", "Fun", "Health & Clothing"];

function BudgetTab() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", value: "", group: "Fun", type: "P" });

  async function load() {
    const r = await fetch("/api/finance").then(r => r.json());
    const all: Entry[] = r.entries ?? [];
    setEntries(all);
    const init: Record<number, string> = {};
    for (const e of all) init[e.id] = e.value.toFixed(2);
    setEdits(init);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function change(id: number, val: string) {
    setEdits(p => ({ ...p, [id]: val }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    const updates = entries
      .filter(e => e.category === "expense" || e.category === "income")
      .map(e => ({ id: e.id, value: parseFloat(edits[e.id] ?? e.value) }))
      .filter(u => !isNaN(u.value));
    await fetch("/api/finance/entries", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    await load();
    setDirty(false);
    setSaving(false);
  }

  async function deleteEntry(id: number) {
    await fetch("/api/finance/entries", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await load();
  }

  async function addEntry() {
    const v = parseFloat(newItem.value);
    if (!newItem.name.trim() || isNaN(v)) return;
    await fetch("/api/finance/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "expense", name: newItem.name, value: v, metadata: { group: newItem.group, type: newItem.type } }),
    });
    setNewItem({ name: "", value: "", group: "Fun", type: "P" });
    setAdding(false);
    await load();
  }

  if (loading) return <p className="text-zinc-500 text-sm text-center py-8">Loading...</p>;

  const income = entries.filter(e => e.category === "income");
  const expenses = entries.filter(e => e.category === "expense");
  const grouped: Record<string, Entry[]> = {};
  for (const e of expenses) {
    const g = (e.metadata as any)?.group || "Other";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(e);
  }
  const groupKeys = [...GROUP_ORDER.filter(g => grouped[g]), ...Object.keys(grouped).filter(g => !GROUP_ORDER.includes(g))];

  const inputClass = "w-24 glass rounded-lg px-2 py-1 text-sm text-right text-white focus:outline-none focus:border-indigo-500/50 tabular-nums";

  return (
    <div className="space-y-4">
      {/* Income */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-emerald-500/70 mb-2">Income</p>
        {income.map(e => (
          <div key={e.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <span className="text-sm text-zinc-300">{e.name}</span>
            <input type="number" step="0.01" value={edits[e.id] ?? ""} onChange={ev => change(e.id, ev.target.value)} className={inputClass} />
          </div>
        ))}
      </div>

      {/* Expense groups */}
      {groupKeys.map(group => (
        <div key={group}>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500/70 mb-2">{group}</p>
          {grouped[group].map(e => {
            const isSaving = (e.metadata as any)?.type === "S";
            return (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 group">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {isSaving && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-violet-500" />}
                  <span className="text-sm text-zinc-300 truncate">{e.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.01" value={edits[e.id] ?? ""} onChange={ev => change(e.id, ev.target.value)} className={inputClass} />
                  <button onClick={() => deleteEntry(e.id)} className="text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-xs">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Add new */}
      {adding ? (
        <div className="glass rounded-xl p-3 space-y-2">
          <input type="text" placeholder="Expense name" value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} className="w-full glass rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
          <div className="flex gap-2">
            <input type="number" placeholder="Monthly €" value={newItem.value} onChange={e => setNewItem(p => ({ ...p, value: e.target.value }))} className="flex-1 glass rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            <select value={newItem.group} onChange={e => setNewItem(p => ({ ...p, group: e.target.value }))} className="flex-1 glass rounded-lg px-2 py-2 text-sm text-white focus:outline-none bg-transparent">
              {GROUP_ORDER.map(g => <option key={g} value={g} className="bg-zinc-900">{g}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <select value={newItem.type} onChange={e => setNewItem(p => ({ ...p, type: e.target.value }))} className="flex-1 glass rounded-lg px-2 py-2 text-sm text-white focus:outline-none bg-transparent">
              <option value="E" className="bg-zinc-900">Essential</option>
              <option value="P" className="bg-zinc-900">Personal</option>
              <option value="S" className="bg-zinc-900">Savings/Investment</option>
            </select>
            <button onClick={() => setAdding(false)} className="flex-1 py-2 text-xs text-zinc-500 rounded-lg">Cancel</button>
            <button onClick={addEntry} className="flex-1 py-2 text-xs text-indigo-300 rounded-lg" style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)" }}>Add</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">+ Add expense</button>
      )}

      <div className="flex gap-2 pt-2">
        <button onClick={() => setAdding(false)} className="flex-1" />
        {dirty && (
          <button onClick={save} disabled={saving} className="w-full py-3 rounded-2xl text-sm font-medium transition-all disabled:opacity-50" style={{ background: "rgba(99,102,241,0.3)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc" }}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        )}
      </div>
      <p className="text-[10px] text-zinc-600 text-center">Purple dot = savings/investment. Hover a row to delete.</p>
    </div>
  );
}

// ── FIRE tab ──────────────────────────────────────────────────────────────────
function FireTab() {
  const [multiplier, setMultiplier] = useState("25");
  const [annualReturn, setAnnualReturn] = useState("7");
  const [retireAge, setRetireAge] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("fire_settings") ?? "{}");
      if (s.multiplier) setMultiplier(String(s.multiplier));
      if (s.annualReturn) setAnnualReturn(String(s.annualReturn));
      if (s.retireAge) setRetireAge(String(s.retireAge));
    } catch {}
  }, []);

  function save() {
    localStorage.setItem("fire_settings", JSON.stringify({
      multiplier: parseFloat(multiplier) || 25,
      annualReturn: parseFloat(annualReturn) || 7,
      retireAge: retireAge ? parseInt(retireAge) : null,
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const inputClass = "w-full glass rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none";

  return (
    <div className="space-y-5">
      <p className="text-xs text-zinc-500 leading-relaxed">
        Configure how your FIRE progress is calculated. Changes apply the next time you open the Finance tab.
      </p>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-zinc-400 block mb-1">Safe withdrawal rate multiplier</label>
          <p className="text-[10px] text-zinc-600 mb-1.5">25× annual expenses = 4% SWR (standard). 33× = 3% SWR (more conservative).</p>
          <input type="number" step="1" value={multiplier} onChange={e => setMultiplier(e.target.value)} className={inputClass} placeholder="25" />
        </div>

        <div>
          <label className="text-xs text-zinc-400 block mb-1">Expected annual return (%)</label>
          <p className="text-[10px] text-zinc-600 mb-1.5">Historical global market average is ~7% inflation-adjusted.</p>
          <input type="number" step="0.5" value={annualReturn} onChange={e => setAnnualReturn(e.target.value)} className={inputClass} placeholder="7" />
        </div>

        <div>
          <label className="text-xs text-zinc-400 block mb-1">Target retirement age (optional)</label>
          <p className="text-[10px] text-zinc-600 mb-1.5">Shown alongside the years-to-FIRE estimate.</p>
          <input type="number" step="1" value={retireAge} onChange={e => setRetireAge(e.target.value)} className={inputClass} placeholder="e.g. 50" />
        </div>
      </div>

      <button
        onClick={save}
        className="w-full py-3 rounded-2xl font-medium text-sm transition-all"
        style={{ background: saved ? "rgba(34,197,94,0.2)" : "rgba(99,102,241,0.3)", border: `1px solid ${saved ? "rgba(34,197,94,0.4)" : "rgba(99,102,241,0.4)"}`, color: saved ? "#86efac" : "#a5b4fc" }}
      >
        {saved ? "Saved ✓" : "Save FIRE settings"}
      </button>
    </div>
  );
}

// ── Main SettingsPanel ────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "budget", label: "Budget" },
  { id: "fire", label: "FIRE" },
];

export default function SettingsPanel({ onPhotoChange }: { onPhotoChange?: (photo: string) => void }) {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div>
      {/* Sub-nav */}
      <div className="flex gap-1 mb-5 bg-white/5 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === t.id ? "bg-indigo-500/30 text-indigo-300" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileSection onPhotoChange={onPhotoChange} />}
      {tab === "budget" && <BudgetTab />}
      {tab === "fire" && <FireTab />}
    </div>
  );
}
