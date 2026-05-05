"use client";

import { useState, useEffect } from "react";
import ProfileSection from "./ProfileSection";

type Tab = "profile" | "budget" | "fire" | "notifications";

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

  if (loading) return <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Loading...</p>;

  const income = entries.filter(e => e.category === "income");
  const expenses = entries.filter(e => e.category === "expense");
  const grouped: Record<string, Entry[]> = {};
  for (const e of expenses) {
    const g = (e.metadata as any)?.group || "Other";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(e);
  }
  const groupKeys = [...GROUP_ORDER.filter(g => grouped[g]), ...Object.keys(grouped).filter(g => !GROUP_ORDER.includes(g))];

  const inputClass = "w-24 glass rounded-lg px-2 py-1 text-sm text-right focus:outline-none tabular-nums";

  return (
    <div className="space-y-4">
      {/* Income */}
      <div>
        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--c-positive)" }}>Income</p>
        {income.map(e => (
          <div key={e.id} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--divider)" }}>
            <span className="text-sm" style={{ color: "var(--text-dim)" }}>{e.name}</span>
            <input type="number" step="0.01" value={edits[e.id] ?? ""} onChange={ev => change(e.id, ev.target.value)} className={inputClass} />
          </div>
        ))}
      </div>

      {/* Expense groups */}
      {groupKeys.map(group => (
        <div key={group}>
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>{group}</p>
          {grouped[group].map(e => {
            const isSaving = (e.metadata as any)?.type === "S";
            return (
              <div key={e.id} className="flex items-center justify-between py-2 group" style={{ borderBottom: "1px solid var(--divider)" }}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {isSaving && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--c-secondary)" }} />}
                  <span className="text-sm truncate" style={{ color: "var(--text-dim)" }}>{e.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.01" value={edits[e.id] ?? ""} onChange={ev => change(e.id, ev.target.value)} className={inputClass} />
                  <button onClick={() => deleteEntry(e.id)} className="transition-colors opacity-0 group-hover:opacity-100 text-xs" style={{ color: "var(--text-muted)" }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Add new */}
      {adding ? (
        <div className="glass rounded-xl p-3 space-y-2">
          <input type="text" placeholder="Expense name" value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} className="w-full glass rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ color: "var(--text)" }} />
          <div className="flex gap-2">
            <input type="number" placeholder="Monthly €" value={newItem.value} onChange={e => setNewItem(p => ({ ...p, value: e.target.value }))} className="flex-1 glass rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ color: "var(--text)" }} />
            <select value={newItem.group} onChange={e => setNewItem(p => ({ ...p, group: e.target.value }))} className="flex-1 glass rounded-lg px-2 py-2 text-sm focus:outline-none" style={{ color: "var(--text)", background: "var(--input-bg)" }}>
              {GROUP_ORDER.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <select value={newItem.type} onChange={e => setNewItem(p => ({ ...p, type: e.target.value }))} className="flex-1 glass rounded-lg px-2 py-2 text-sm focus:outline-none" style={{ color: "var(--text)", background: "var(--input-bg)" }}>
              <option value="E">Essential</option>
              <option value="P">Personal</option>
              <option value="S">Savings/Investment</option>
            </select>
            <button onClick={() => setAdding(false)} className="flex-1 py-2 text-xs rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}>Cancel</button>
            <button onClick={addEntry} className="flex-1 py-2 text-xs rounded-lg" style={{ background: "var(--c-primary-dim)", border: "1px solid var(--c-primary-border)", color: "var(--c-primary)" }}>Add</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-xs transition-colors" style={{ color: "var(--text-muted)" }}>+ Add expense</button>
      )}

      <div className="flex gap-2 pt-2">
        <button onClick={() => setAdding(false)} className="flex-1" />
        {dirty && (
          <button onClick={save} disabled={saving} className="w-full py-3 rounded-2xl text-sm font-medium transition-all disabled:opacity-50" style={{ background: "rgba(99,102,241,0.3)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc" }}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        )}
      </div>
      <p className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>Purple dot = savings/investment. Hover a row to delete.</p>
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

  const inputClass = "w-full glass rounded-xl px-3 py-2.5 text-sm focus:outline-none";

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Configure how your FIRE progress is calculated. Changes apply the next time you open the Finance tab.
      </p>

      <div className="space-y-4">
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--text-dim)" }}>Safe withdrawal rate multiplier</label>
          <p className="text-[10px] mb-1.5" style={{ color: "var(--text-muted)" }}>25× annual expenses = 4% SWR (standard). 33× = 3% SWR (more conservative).</p>
          <input type="number" step="1" value={multiplier} onChange={e => setMultiplier(e.target.value)} className={inputClass} placeholder="25" />
        </div>

        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--text-dim)" }}>Expected annual return (%)</label>
          <p className="text-[10px] mb-1.5" style={{ color: "var(--text-muted)" }}>Historical global market average is ~7% inflation-adjusted.</p>
          <input type="number" step="0.5" value={annualReturn} onChange={e => setAnnualReturn(e.target.value)} className={inputClass} placeholder="7" />
        </div>

        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--text-dim)" }}>Target retirement age (optional)</label>
          <p className="text-[10px] mb-1.5" style={{ color: "var(--text-muted)" }}>Shown alongside the years-to-FIRE estimate.</p>
          <input type="number" step="1" value={retireAge} onChange={e => setRetireAge(e.target.value)} className={inputClass} placeholder="e.g. 50" />
        </div>
      </div>

      <button
        onClick={save}
        className="w-full py-3 rounded-2xl font-medium text-sm transition-all"
        style={saved
          ? { background: "var(--c-positive-dim)", border: "1px solid var(--c-positive-border)", color: "var(--c-positive)" }
          : { background: "var(--c-primary-dim)", border: "1px solid var(--c-primary-border)", color: "var(--c-primary)" }
        }
      >
        {saved ? "Saved ✓" : "Save FIRE settings"}
      </button>
    </div>
  );
}

// ── Notifications ─────────────────────────────────────────────────────────────
function NotificationsSection() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState<boolean | null>(null); // null = checking
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<"sent" | "failed" | null>(null);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    if (Notification.permission === "granted") checkSubscription();
  }, []);

  async function checkSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { setSubscribed(false); return; }
      const res = await fetch(`/api/push/status?endpoint=${encodeURIComponent(sub.endpoint)}`);
      const { active } = await res.json();
      setSubscribed(active);
    } catch {
      setSubscribed(false);
    }
  }

  async function subscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") { setBusy(false); return; }

      // Unsubscribe any stale browser subscription first
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setSubscribed(true);
    } catch (e) {
      console.error("Push subscribe failed:", e);
    }
    setBusy(false);
  }

  async function sendTest() {
    setBusy(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      setTestResult(res.ok ? "sent" : "failed");
    } catch {
      setTestResult("failed");
    }
    setBusy(false);
  }

  if (permission === "unsupported") return (
    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Push notifications aren't supported in this browser.</p>
  );

  return (
    <div className="space-y-3">
      <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">🔔</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Daily mood reminder</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>8pm every day — only sent if you haven't logged yet</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>AS flare warnings</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Morning check — notified when your data shows early warning signs</p>
          </div>
        </div>
      </div>

      {permission === "denied" ? (
        <p className="text-xs text-center py-2" style={{ color: "var(--c-negative)" }}>
          Notifications blocked — enable them in your browser/OS settings then reload
        </p>
      ) : subscribed ? (
        <div className="space-y-2">
          <p className="text-xs text-center py-1" style={{ color: "var(--c-positive)" }}>
            ✓ Notifications active
          </p>
          <div className="flex gap-2">
            <button
              onClick={sendTest}
              disabled={busy}
              className="flex-1 py-2.5 rounded-2xl text-sm transition-all disabled:opacity-50"
              style={{ background: "var(--chip-bg)", border: "1px solid var(--chip-border)", color: "var(--text)" }}
            >
              {busy ? "Sending…" : "Send test notification"}
            </button>
            <button
              onClick={subscribe}
              disabled={busy}
              className="py-2.5 px-3 rounded-2xl text-sm transition-all disabled:opacity-50"
              style={{ color: "var(--text-muted)" }}
              title="Re-register subscription"
            >
              ↺
            </button>
          </div>
          {testResult === "sent" && <p className="text-xs text-center" style={{ color: "var(--c-positive)" }}>Notification sent — check your device</p>}
          {testResult === "failed" && <p className="text-xs text-center" style={{ color: "var(--c-negative)" }}>Send failed — check console for errors</p>}
        </div>
      ) : (
        <button
          onClick={subscribe}
          disabled={busy}
          className="w-full py-3 rounded-2xl font-medium text-sm transition-all disabled:opacity-50"
          style={{ background: "var(--c-primary-dim)", border: "1px solid var(--c-primary-border)", color: "var(--c-primary)" }}
        >
          {busy ? "Setting up…" : subscribed === false && permission === "granted" ? "Re-enable notifications" : "Enable notifications"}
        </button>
      )}
    </div>
  );
}

// ── Main SettingsPanel ────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "budget", label: "Budget" },
  { id: "fire", label: "FIRE" },
  { id: "notifications", label: "Alerts" },
];

export default function SettingsPanel({ onPhotoChange }: { onPhotoChange?: (photo: string) => void }) {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div>
      {/* Sub-nav */}
      <div className="flex gap-1 mb-5 rounded-xl p-1" style={{ background: "var(--surface)" }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={tab === t.id
              ? { background: "var(--c-primary-dim)", border: "1px solid var(--c-primary-border)", color: "var(--c-primary)" }
              : { color: "var(--text-muted)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileSection onPhotoChange={onPhotoChange} />}
      {tab === "budget" && <BudgetTab />}
      {tab === "fire" && <FireTab />}
      {tab === "notifications" && <NotificationsSection />}
    </div>
  );
}
