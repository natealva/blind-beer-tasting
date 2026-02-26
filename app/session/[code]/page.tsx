"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseClient } from "@/lib/supabase";
import { BEER_GIFS, getRandomBeerGif } from "@/lib/beerGifs";

export default function SessionJoinPage() {
  const router = useRouter();
  const params = useParams();
  const code = (params?.code as string) ?? "";
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [gifSrc, setGifSrc] = useState(BEER_GIFS[0]);
  useEffect(() => {
    setGifSrc(getRandomBeerGif());
  }, []);

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
    const { data: existingPlayers } = await supabase
      .from("players")
      .select("id, name")
      .eq("session_id", session.id);
    const nameLower = playerName.trim().toLowerCase();
    const existing = existingPlayers?.find((p) => p.name.trim().toLowerCase() === nameLower);
    if (existing) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("player_id", existing.id);
        sessionStorage.setItem("player_name", existing.name.trim());
        sessionStorage.setItem("player_session_code", code);
      }
      router.push(`/session/${code}/play`);
      setLoading(false);
      return;
    }
    const count = existingPlayers?.length ?? 0;
    const orderDirection = count % 2 === 0 ? "ascending" : "descending";
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
      <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  if (error && !sessionName) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-[480px] mx-auto">
          <p className="text-amber-600 mb-4" role="alert">{error}</p>
          <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--amber-gold)] underline">
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-[480px] mx-auto">
        <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--amber-gold)] text-sm mb-6 inline-block">
          ← Back
        </Link>
        <Image
          src={gifSrc}
          alt="Beer cheers"
          width={120}
          height={120}
          unoptimized
          className="mx-auto mb-4 rounded-lg"
        />
        <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-1">{sessionName}</h1>
        <h2 className="text-xl text-[var(--text-muted)] mb-6">Join the Tasting</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[var(--text-muted)] text-sm font-medium mb-1">Your name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full rounded-lg bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-3 py-2.5 placeholder-amber-500 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)]"
            />
          </div>
          {error && <p className="text-amber-600 text-sm" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] disabled:opacity-50 text-[var(--button-text)] font-bold py-3 transition-colors"
          >
            {loading ? "Joining…" : "Join the Tasting"}
          </button>
        </form>
      </div>
    </div>
  );
}
