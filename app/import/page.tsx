"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImportPage() {
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setStatus("Importing...");

    const text = await file.text();
    const res = await fetch("/api/import/daylio", {
      method: "POST",
      body: text,
    });
    const data = await res.json();

    if (res.ok) {
      setStatus(`✓ Imported ${data.imported} entries`);
      setTimeout(() => router.push("/dashboard"), 1500);
    } else {
      setStatus(`Error: ${data.error}`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
      <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h1 className="font-semibold text-lg">Import Daylio CSV</h1>
        <p className="text-sm text-zinc-400">
          Export from Daylio: Settings → Export → CSV. Then upload the file here.
        </p>
        <label className={`block w-full text-center py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
          loading ? "border-zinc-700 text-zinc-600" : "border-zinc-600 hover:border-indigo-500 text-zinc-300"
        }`}>
          {loading ? "Processing..." : "Choose CSV file"}
          <input type="file" accept=".csv" className="hidden" onChange={handleFile} disabled={loading} />
        </label>
        {status && (
          <p className={`text-sm text-center ${status.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>
            {status}
          </p>
        )}
        <a href="/dashboard" className="block text-center text-xs text-zinc-500 hover:text-zinc-300">
          ← Back to dashboard
        </a>
      </div>
    </div>
  );
}
