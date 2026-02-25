"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginForm({ code }: { code: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/session/${code}/admin-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Wrong password");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-amber-200/90 text-sm font-medium mb-1">Admin password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter session admin password"
          className="w-full rounded-lg bg-amber-900/40 border border-amber-700/50 text-amber-100 px-3 py-2 placeholder-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-amber-950 font-semibold py-3 transition-colors"
      >
        {loading ? "Checking…" : "Unlock admin"}
      </button>
    </form>
  );
}
