"use client";

import { useEffect, useState, useRef } from "react";

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
  photo: string | null;
}

const EMPTY: Profile = {
  name: null, age: null, occupation: null, location: null,
  healthConditions: null, medications: null, fitnessGoals: null,
  financialGoals: null, about: null, photo: null,
};

function Field({ label, hint, value, onChange, multiline }: {
  label: string; hint?: string; value: string;
  onChange: (v: string) => void; multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-xs block mb-1 font-medium" style={{ color: "var(--text-dim)" }}>{label}</label>
      {hint && <p className="text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>{hint}</p>}
      {multiline ? (
        <textarea
          rows={3}
          className="w-full glass rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none transition-colors"
          style={{ color: "var(--text)", background: "var(--input-bg)", border: "1px solid var(--chip-border)" }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type="text"
          className="w-full glass rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors"
          style={{ color: "var(--text)", background: "var(--input-bg)", border: "1px solid var(--chip-border)" }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfileSection({ onPhotoChange }: { onPhotoChange?: (photo: string) => void }) {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((d) => { if (d) setProfile(d); setLoading(false); });
  }, []);

  function set(field: keyof Profile, value: string) {
    setProfile((p) => ({ ...p, [field]: value || null }));
    setSaved(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImage(file);
    setProfile((p) => ({ ...p, photo: dataUrl }));
    onPhotoChange?.(dataUrl);
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
    if (profile.photo) onPhotoChange?.(profile.photo);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Loading...</p>;

  return (
    <div className="space-y-5">
      {/* Photo */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative w-20 h-20 rounded-full overflow-hidden border-2 transition-all flex-shrink-0 group"
          style={{ background: "linear-gradient(135deg, var(--c-primary), var(--c-secondary))", borderColor: "var(--border)" }}
        >
          {profile.photo ? (
            <img src={profile.photo} alt="profile" className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-2xl font-bold text-white">
              {profile.name ? profile.name[0].toUpperCase() : "?"}
            </span>
          )}
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-xs text-white font-medium">Change</span>
          </div>
        </button>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{profile.name || "Add your name"}</p>
          <button onClick={() => fileRef.current?.click()} className="text-xs mt-1 transition-colors" style={{ color: "var(--c-primary)" }}>
            Change photo
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
      </div>

      <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Shared with the AI chat to personalise responses — health conditions, goals, and context that would otherwise need explaining every time.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" value={profile.name ?? ""} onChange={(v) => set("name", v)} />
        <Field label="Age" value={profile.age?.toString() ?? ""} onChange={(v) => set("age", v)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Occupation" value={profile.occupation ?? ""} onChange={(v) => set("occupation", v)} />
        <Field label="Location" value={profile.location ?? ""} onChange={(v) => set("location", v)} />
      </div>

      <Field label="Health conditions" hint="Chronic illness, diagnoses, anything relevant to your health data" value={profile.healthConditions ?? ""} onChange={(v) => set("healthConditions", v)} multiline />
      <Field label="Medications & supplements" hint="Helps contextualise HRV, sleep, and mood patterns" value={profile.medications ?? ""} onChange={(v) => set("medications", v)} multiline />
      <Field label="Fitness goals" hint="e.g. improve HRV, run 5k, lose weight" value={profile.fitnessGoals ?? ""} onChange={(v) => set("fitnessGoals", v)} multiline />
      <Field label="Financial goals" hint="e.g. retire early, build emergency fund, pay off debt" value={profile.financialGoals ?? ""} onChange={(v) => set("financialGoals", v)} multiline />
      <Field label="About you" hint="Anything else — family situation, lifestyle, context the chatbot should know" value={profile.about ?? ""} onChange={(v) => set("about", v)} multiline />

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-2xl font-semibold text-sm transition-all disabled:opacity-50"
        style={saved
          ? { background: "var(--c-positive-dim)", border: "1px solid var(--c-positive-border)", color: "var(--c-positive)" }
          : { background: "var(--c-primary-dim)", border: "1px solid var(--c-primary-border)", color: "var(--c-primary)" }
        }
      >
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save profile"}
      </button>
    </div>
  );
}
