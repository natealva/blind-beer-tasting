"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";
import type { Rating } from "@/types/database";

function getPlayerIdFromCookie(code: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`blind_beer_player_${code}=([^;]+)`));
  return match ? match[1] : null;
}

export default function SessionPlayPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string) ?? "";
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [beerCount, setBeerCount] = useState(0);
  const [orderDirection, setOrderDirection] = useState<"ascending" | "descending">("ascending");
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    const pid = getPlayerIdFromCookie(code);
    if (!pid) {
      router.replace(`/session/${code}/join`);
      return;
    }
    setPlayerId(pid);
    const supabase = createSupabaseClient();
    supabase
      .from("sessions")
      .select("id, name, beer_count")
      .eq("code", code)
      .single()
      .then(({ data: session, error: se }) => {
        if (se || !session) {
          setLoading(false);
          return;
        }
        setSessionId(session.id);
        setSessionName(session.name);
        setBeerCount(session.beer_count);
        supabase
          .from("players")
          .select("order_direction")
          .eq("id", pid)
          .single()
          .then(({ data: player }) => {
            if (player) setOrderDirection(player.order_direction);
          });
        supabase
          .from("ratings")
          .select("*")
          .eq("session_id", session.id)
          .eq("player_id", pid)
          .then(({ data }) => setRatings(data ?? []));
        setLoading(false);
      });
  }, [code, router]);

  const beerNumbers =
    orderDirection === "ascending"
      ? Array.from({ length: beerCount }, (_, i) => i + 1)
      : Array.from({ length: beerCount }, (_, i) => beerCount - i);

  async function saveRating(beerNumber: number, data: { crushability?: number; taste?: number; guess?: string; notes?: string }) {
    if (!sessionId || !playerId) return;
    setSaving(beerNumber);
    const supabase = createSupabaseClient();
    await supabase.from("ratings").upsert(
      {
        session_id: sessionId,
        player_id: playerId,
        beer_number: beerNumber,
        crushability: data.crushability ?? null,
        taste: data.taste ?? null,
        guess: data.guess ?? null,
        notes: data.notes ?? null,
      },
      { onConflict: "player_id,beer_number" }
    );
    const { data: updated } = await supabase
      .from("ratings")
      .select("*")
      .eq("session_id", sessionId)
      .eq("player_id", playerId);
    setRatings(updated ?? []);
    setSaving(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-950/30 text-amber-100 flex items-center justify-center">
        <p className="text-amber-300">Loading…</p>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-amber-950/30 text-amber-100 flex items-center justify-center">
        <p className="text-red-400">Session not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-950/30 text-amber-100">
      <div className="max-w-xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-amber-200">{sessionName}</h1>
            <p className="text-amber-200/60 text-sm">Code: {code}</p>
          </div>
          <Link href="/" className="text-amber-400 hover:text-amber-300 text-sm">
            Home
          </Link>
        </div>

        <p className="text-amber-200/80 text-sm mb-6">
          Rate each beer. Your order: {orderDirection === "ascending" ? "1 → " + beerCount : beerCount + " → 1"}.
        </p>

        <div className="space-y-6">
          {beerNumbers.map((num) => {
            const existing = ratings.find((r) => r.beer_number === num);
            return (
              <BeerRatingCard
                key={num}
                beerNumber={num}
                existing={existing ?? null}
                onSave={(data) => saveRating(num, data)}
                saving={saving === num}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BeerRatingCard({
  beerNumber,
  existing,
  onSave,
  saving,
}: {
  beerNumber: number;
  existing: Rating | null;
  onSave: (data: { crushability?: number; taste?: number; guess?: string; notes?: string }) => void;
  saving: boolean;
}) {
  const [crushability, setCrushability] = useState(existing?.crushability ?? "");
  const [taste, setTaste] = useState(existing?.taste ?? "");
  const [guess, setGuess] = useState(existing?.guess ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const cNum = crushability === "" ? null : parseInt(String(crushability), 10);
  const tNum = taste === "" ? null : parseInt(String(taste), 10);
  const valid = (cNum == null || (cNum >= 1 && cNum <= 10)) && (tNum == null || (tNum >= 1 && tNum <= 10));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onSave({
      crushability: cNum ?? undefined,
      taste: tNum ?? undefined,
      guess: guess.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="rounded-xl bg-amber-900/40 border border-amber-700/50 overflow-hidden">
      <div className="px-4 py-2 border-b border-amber-700/50 bg-amber-900/50">
        <span className="font-mono font-semibold text-amber-300">Beer #{beerNumber}</span>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-amber-200/90 text-sm font-medium mb-1">Crushability (1–10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={crushability}
              onChange={(e) => setCrushability(e.target.value)}
              placeholder="—"
              className="w-full rounded-lg bg-amber-950/50 border border-amber-700/50 text-amber-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block text-amber-200/90 text-sm font-medium mb-1">Taste (1–10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={taste}
              onChange={(e) => setTaste(e.target.value)}
              placeholder="—"
              className="w-full rounded-lg bg-amber-950/50 border border-amber-700/50 text-amber-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-amber-200/90 text-sm font-medium mb-1">Your guess (optional)</label>
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="e.g. IPA from Local Brewery"
            className="w-full rounded-lg bg-amber-950/50 border border-amber-700/50 text-amber-100 px-3 py-2 placeholder-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-amber-200/90 text-sm font-medium mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tasting notes…"
            rows={2}
            className="w-full rounded-lg bg-amber-950/50 border border-amber-700/50 text-amber-100 px-3 py-2 placeholder-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !valid}
          className="w-full rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-amber-950 font-semibold py-2.5 transition-colors"
        >
          {saving ? "Saving…" : existing ? "Update rating" : "Save rating"}
        </button>
      </form>
    </div>
  );
}
