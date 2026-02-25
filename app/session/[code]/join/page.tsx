"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";

export default function SessionJoinPage() {
  const router = useRouter();
  const params = useParams();
  const code = (params?.code as string) ?? "";
  const [name, setName] = useState("");
  const [orderDirection, setOrderDirection] = useState<"ascending" | "descending">("ascending");
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseClient();
    supabase
      .from("sessions")
      .select("name, is_active")
      .eq("code", code)
      .single()
      .then(({ data, error: e }) => {
        setChecking(false);
        if (e || !data) {
          setError("Session not found.");
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
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    setError(null);
    setLoading(true);
    const supabase = createSupabaseClient();
    const { data: session } = await supabase.from("sessions").select("id").eq("code", code).single();
    if (!session) {
      setError("Session not found.");
      setLoading(false);
      return;
    }
    const { data: player, error: insertError } = await supabase
      .from("players")
      .insert({
        session_id: session.id,
        name: name.trim(),
        order_direction: orderDirection,
      })
      .select("id")
      .single();
    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }
    document.cookie = `blind_beer_player_${code}=${player.id}; path=/; max-age=86400; SameSite=Lax`;
    router.push(`/session/${code}/play`);
    setLoading(false);
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-amber-950/30 text-amber-100 flex items-center justify-center">
        <p className="text-amber-300">Loading…</p>
      </div>
    );
  }

  if (error && !sessionName) {
    return (
      <div className="min-h-screen bg-amber-950/30 text-amber-100">
        <div className="max-w-md mx-auto px-6 py-12">
          <p className="text-red-400 mb-4">{error}</p>
          <Link href="/join" className="text-amber-400 hover:text-amber-300">
            ← Try another code
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-950/30 text-amber-100">
      <div className="max-w-md mx-auto px-6 py-12">
        <Link href={`/join`} className="text-amber-400 hover:text-amber-300 text-sm mb-6 inline-block">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-amber-200 mb-1">{sessionName}</h1>
        <p className="text-amber-200/70 text-sm mb-6">Code: {code}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-amber-200/90 text-sm font-medium mb-1">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full rounded-lg bg-amber-900/40 border border-amber-700/50 text-amber-100 px-3 py-2 placeholder-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-amber-200/90 text-sm font-medium mb-1">Beer order</label>
            <select
              value={orderDirection}
              onChange={(e) => setOrderDirection(e.target.value as "ascending" | "descending")}
              className="w-full rounded-lg bg-amber-900/40 border border-amber-700/50 text-amber-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ascending">1 → last</option>
              <option value="descending">Last → 1</option>
            </select>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-amber-950 font-semibold py-3 transition-colors"
          >
            {loading ? "Joining…" : "Join tasting"}
          </button>
        </form>
      </div>
    </div>
  );
}
