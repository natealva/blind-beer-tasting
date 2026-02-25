"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginForm({ code }: { code: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem(`blind_beer_admin_${code}`) : null;
    if (!stored) return;
    fetch(`/api/session/${code}/admin-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: stored }),
    })
      .then((res) => {
        if (res.ok) {
          sessionStorage.removeItem(`blind_beer_admin_${code}`);
          router.refresh();
        }
      })
      .catch(() => {});
  }, [code, router]);

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
        <label className="block text-[var(--text-muted)] text-sm font-medium mb-1">Admin password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter session admin password"
          className="w-full rounded-lg bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-3 py-2 placeholder-amber-500 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)]"
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] disabled:opacity-50 text-[var(--button-text)] font-semibold py-3 transition-colors"
      >
        {loading ? "Checking…" : "Unlock admin"}
      </button>
    </form>
  );
}
