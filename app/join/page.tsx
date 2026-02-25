"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter the session code.");
      return;
    }
    setError(null);
    setLoading(true);
    const supabase = createSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("sessions")
      .select("id, code, name, is_active")
      .eq("code", trimmed)
      .single();
    if (fetchError || !data) {
      setError("Session not found or inactive. Check the code.");
      setLoading(false);
      return;
    }
    if (!data.is_active) {
      setError("This session is no longer active.");
      setLoading(false);
      return;
    }
    router.push(`/session/${data.code}/join`);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-amber-950/30 text-amber-100">
      <div className="max-w-md mx-auto px-6 py-12">
        <Link href="/" className="text-amber-400 hover:text-amber-300 text-sm mb-6 inline-block">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-amber-200 mb-6">Join a tasting</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-amber-200/90 text-sm font-medium mb-1">Session code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABC123"
              maxLength={12}
              className="w-full rounded-lg bg-amber-900/40 border border-amber-700/50 text-amber-100 px-3 py-2 placeholder-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-amber-950 font-semibold py-3 transition-colors"
          >
            {loading ? "Checking…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
