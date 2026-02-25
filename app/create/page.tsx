"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";
import { generateSessionCode } from "@/lib/code";

export default function CreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [beerCount, setBeerCount] = useState(13);
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseClient();
    let code = generateSessionCode(6);
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      const { data, error: insertError } = await supabase
        .from("sessions")
        .insert({
          code,
          name: name.trim() || "Blind Tasting",
          beer_count: Math.min(99, Math.max(1, beerCount)),
          admin_password: adminPassword || "admin",
        })
        .select("id, code")
        .single();
      if (!insertError) {
        const pwd = adminPassword || "admin";
        const authRes = await fetch(`/api/session/${data.code}/admin-auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pwd }),
        });
        if (!authRes.ok) {
          setError("Session created but could not sign you in. Go to the session and enter the password.");
          setLoading(false);
          return;
        }
        router.push(`/session/${data.code}/admin`);
        return;
      }
      if (insertError.code === "23505") {
        code = generateSessionCode(6);
        continue;
      }
      setError(insertError.message);
      setLoading(false);
      return;
    }
    setError("Could not generate unique code. Try again.");
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-amber-950/30 text-amber-100">
      <div className="max-w-md mx-auto px-6 py-12">
        <Link href="/" className="text-amber-400 hover:text-amber-300 text-sm mb-6 inline-block">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-amber-200 mb-6">Create a tasting session</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-amber-200/90 text-sm font-medium mb-1">Session name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Friday Night Tasting"
              className="w-full rounded-lg bg-amber-900/40 border border-amber-700/50 text-amber-100 px-3 py-2 placeholder-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-amber-200/90 text-sm font-medium mb-1">Number of beers</label>
            <input
              type="number"
              min={1}
              max={99}
              value={beerCount}
              onChange={(e) => setBeerCount(parseInt(e.target.value, 10) || 13)}
              className="w-full rounded-lg bg-amber-900/40 border border-amber-700/50 text-amber-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-amber-200/90 text-sm font-medium mb-1">Admin password</label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Required to manage session & reveals"
              className="w-full rounded-lg bg-amber-900/40 border border-amber-700/50 text-amber-100 px-3 py-2 placeholder-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-amber-950 font-semibold py-3 transition-colors"
          >
            {loading ? "Creating…" : "Create session"}
          </button>
        </form>
      </div>
    </div>
  );
}
