"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";

export default function SessionJoinPage() {
  const router = useRouter();
  const params = useParams();
  const code = (params?.code as string) ?? "";
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseClient();
    supabase
      .from("sessions")
      .select("id, name, is_active")
      .eq("code", code)
      .single()
      .then(({ data, error: e }) => {
        setChecking(false);
        if (e || !data) {
          setError("Session not found. Check your code!");
          return;
        }
        if (!data.is_active) {
          setError("This session is no longer active.");
          return;
        }
        setSessionName(data.name);
      });
  }, [code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!playerName.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!sessionName) return;
    setError(null);
    setLoading(true);
    const supabase = createSupabaseClient();
    const { data: session } = await supabase.from("sessions").select("id").eq("code", code).single();
    if (!session) {
      setError("Session not found.");
      setLoading(false);
      return;
    }
    const { count } = await supabase
      .from("players")
      .select("*", { count: "exact", head: true })
      .eq("session_id", session.id);
    const orderDirection = count != null && count % 2 === 0 ? "ascending" : "descending";
    const { data: player, error: insertError } = await supabase
      .from("players")
      .insert({
        session_id: session.id,
        name: playerName.trim(),
        order_direction: orderDirection,
      })
      .select("id")
      .single();
    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }
    if (typeof window !== "undefined") {
      sessionStorage.setItem("player_id", player.id);
      sessionStorage.setItem("player_name", playerName.trim());
      sessionStorage.setItem("player_session_code", code);
    }
    router.push(`/session/${code}/play`);
    setLoading(false);
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[var(--amber-dark)] text-[var(--amber-light)] flex items-center justify-center">
        <p className="text-[var(--amber-muted)]">Loading…</p>
      </div>
    );
  }

  if (error && !sessionName) {
    return (
      <div className="min-h-screen bg-[var(--amber-dark)] text-[var(--amber-light)] flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-[480px] mx-auto">
          <p className="text-amber-400 mb-4" role="alert">{error}</p>
          <Link href="/" className="text-[var(--amber-muted)] hover:text-[var(--amber-warm)] underline">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--amber-dark)] text-[var(--amber-light)] flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-[480px] mx-auto">
        <Link href="/" className="text-[var(--amber-muted)] hover:text-[var(--amber-warm)] text-sm mb-6 inline-block">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-[var(--amber-light)] mb-1">{sessionName}</h1>
        <h2 className="text-xl text-[var(--amber-muted)] mb-6">Join the Tasting</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[var(--amber-muted)] text-sm font-medium mb-1">Your name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full rounded-lg bg-[var(--amber-darker)] border-2 border-[var(--amber-border)] text-[var(--amber-light)] px-3 py-2.5 placeholder-amber-600 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)]"
            />
          </div>
          {error && <p className="text-amber-400 text-sm" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-warm)] disabled:opacity-50 text-[var(--amber-darker)] font-bold py-3 transition-colors"
          >
            {loading ? "Joining…" : "Join the Tasting"}
          </button>
        </form>
      </div>
    </div>
  );
}
