"use client";

import { useEffect, useState } from "react";

interface Profile {
  name: string | null;
  age: number | null;
  occupation: string | null;
  location: string | null;
  healthConditions: string | null;
  medications: string | null;
  fitnessGoals: string | null;
  financialGoals: string | null;
  about: string | null;
}

const EMPTY: Profile = {
  name: null, age: null, occupation: null, location: null,
  healthConditions: null, medications: null, fitnessGoals: null,
  financialGoals: null, about: null,
};

function Field({ label, hint, value, onChange, multiline }: {
  label: string; hint?: string; value: string;
  onChange: (v: string) => void; multiline?: boolean;
}) {
  const base = "w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors";
  return (
    <div>
      <label className="text-xs text-zinc-400 block mb-1">{label}</label>
      {hint && <p className="text-xs text-zinc-600 mb-1.5">{hint}</p>}
      {multiline ? (
        <textarea rows={3} className={`${base} resize-none`} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type="text" className={base} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

export default function ProfileSection() {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => { if (d) setProfile(d); setLoading(false); });
  }, []);

  function set(field: keyof Profile, value: string) {
    setProfile((p) => ({ ...p, [field]: value || null }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <p className="text-zinc-500 text-sm text-center py-8">Loading profile...</p>;

  return (
    <div className="space-y-5">
      <p className="text-xs text-zinc-500 leading-relaxed">
        This information is shared with the AI chatbot to personalise its responses — things like health conditions, goals, and context that would otherwise need to be explained every time.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" value={profile.name ?? ""} onChange={(v) => set("name", v)} />
        <Field label="Age" value={profile.age?.toString() ?? ""} onChange={(v) => set("age", v)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Occupation" value={profile.occupation ?? ""} onChange={(v) => set("occupation", v)} />
        <Field label="Location" value={profile.location ?? ""} onChange={(v) => set("location", v)} />
      </div>

      <Field
        label="Health conditions"
        hint="Chronic illness, diagnoses, anything relevant to your health data"
        value={profile.healthConditions ?? ""}
        onChange={(v) => set("healthConditions", v)}
        multiline
      />

      <Field
        label="Medications & supplements"
        hint="Optional — helps contextualise HRV, sleep, mood patterns"
        value={profile.medications ?? ""}
        onChange={(v) => set("medications", v)}
        multiline
      />

      <Field
        label="Fitness goals"
        hint="e.g. run a 5k, improve HRV, lose weight, build muscle"
        value={profile.fitnessGoals ?? ""}
        onChange={(v) => set("fitnessGoals", v)}
        multiline
      />

      <Field
        label="Financial goals"
        hint="e.g. build emergency fund, retire by 50, pay off debt"
        value={profile.financialGoals ?? ""}
        onChange={(v) => set("financialGoals", v)}
        multiline
      />

      <Field
        label="About you"
        hint="Anything else you'd like the chatbot to know — family situation, lifestyle, context"
        value={profile.about ?? ""}
        onChange={(v) => set("about", v)}
        multiline
      />

      <button
        onClick={save}
        disabled={saving}
        className={`w-full py-3 rounded-2xl font-medium text-sm transition-all ${
          saved ? "bg-emerald-600 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white"
        } disabled:opacity-50`}
      >
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save profile"}
      </button>
    </div>
  );
}
