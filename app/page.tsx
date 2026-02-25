"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter a session code.");
      return;
    }
    setError(null);
    setLoading(true);
    const supabase = createSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("sessions")
      .select("id, code, is_active")
      .eq("code", trimmed)
      .single();
    if (fetchError || !data) {
      setError("Session not found. Check your code!");
      setLoading(false);
      return;
    }
    if (!data.is_active) {
      setError("Session not found. Check your code!");
      setLoading(false);
      return;
    }
    router.push(`/session/${data.code}`);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[var(--amber-dark)] text-[var(--amber-light)] flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-[480px] mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold text-center mb-10 text-[var(--amber-light)]">
          🍺 Blind Beer Tasting
        </h1>
        <form onSubmit={handleJoin} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="Enter code e.g. BREW42"
            className="w-full rounded-lg bg-[var(--amber-darker)] border-2 border-[var(--amber-border)] text-[var(--amber-light)] px-4 py-3 text-lg placeholder-amber-600 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)] focus:border-[var(--amber-gold)] uppercase tracking-wider"
          />
          {error && (
            <p className="text-amber-400 text-center text-sm" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-warm)] text-[var(--amber-darker)] font-bold py-3.5 text-lg transition-colors disabled:opacity-60"
          >
            {loading ? "Checking…" : "Join Tasting"}
          </button>
        </form>
        <p className="text-center mt-8 text-[var(--amber-muted)] text-sm">
          <Link href="/create" className="hover:text-[var(--amber-warm)] underline underline-offset-2">
            Host a tasting? Create session →
          </Link>
        </p>
      </div>
    </div>
  );
}
