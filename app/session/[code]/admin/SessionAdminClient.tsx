"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";
import type { BeerReveal, Player, Rating } from "@/types/database";

type Props = {
  code: string;
  sessionId: string;
  sessionName: string;
  beerCount: number;
};

export default function SessionAdminClient({ code, sessionId, sessionName, beerCount }: Props) {
  const [reveals, setReveals] = useState<BeerReveal[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [tab, setTab] = useState<"reveals" | "players" | "results">("reveals");
  const [newBeerNumber, setNewBeerNumber] = useState(1);
  const [newBeerName, setNewBeerName] = useState("");
  const [newBrewery, setNewBrewery] = useState("");
  const [newStyle, setNewStyle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseClient();
    supabase
      .from("beer_reveals")
      .select("*")
      .eq("session_id", sessionId)
      .order("beer_number")
      .then(({ data }) => setReveals(data ?? []));
    supabase
      .from("players")
      .select("*")
      .eq("session_id", sessionId)
      .then(({ data }) => setPlayers(data ?? []));
    supabase
      .from("ratings")
      .select("*")
      .eq("session_id", sessionId)
      .then(({ data }) => setRatings(data ?? []));
  }, [sessionId]);

  async function addReveal(e: React.FormEvent) {
    e.preventDefault();
    if (!newBeerName.trim()) return;
    setSaving(true);
    const supabase = createSupabaseClient();
    const num = Math.min(beerCount, Math.max(1, newBeerNumber));
    await supabase.from("beer_reveals").upsert(
      {
        session_id: sessionId,
        beer_number: num,
        beer_name: newBeerName.trim(),
        brewery: newBrewery.trim() || null,
        style: newStyle.trim() || null,
      },
      { onConflict: "session_id,beer_number" }
    );
    const { data } = await supabase
      .from("beer_reveals")
      .select("*")
      .eq("session_id", sessionId)
      .order("beer_number");
    setReveals(data ?? []);
    setNewBeerName("");
    setNewBrewery("");
    setNewStyle("");
    setNewBeerNumber(reveals.length + 1);
    setSaving(false);
  }

  async function deleteReveal(id: string) {
    const supabase = createSupabaseClient();
    await supabase.from("beer_reveals").delete().eq("id", id);
    setReveals((prev) => prev.filter((r) => r.id !== id));
  }

  const ratingsByPlayer = players.map((p) => ({
    player: p,
    ratings: ratings.filter((r) => r.player_id === p.id),
  }));

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-amber-200">{sessionName}</h1>
          <p className="text-amber-200/70 text-sm">Code: <span className="font-mono">{code}</span> · Share this so players can join</p>
        </div>
        <Link href="/" className="text-amber-400 hover:text-amber-300 text-sm">
          Home
        </Link>
      </div>

      <div className="flex gap-2 mb-6 border-b border-amber-700/50 pb-2">
        <button
          type="button"
          onClick={() => setTab("reveals")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "reveals" ? "bg-amber-600 text-amber-950" : "text-amber-200/80 hover:bg-amber-900/40"}`}
        >
          Beer reveals
        </button>
        <button
          type="button"
          onClick={() => setTab("players")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "players" ? "bg-amber-600 text-amber-950" : "text-amber-200/80 hover:bg-amber-900/40"}`}
        >
          Players ({players.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("results")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "results" ? "bg-amber-600 text-amber-950" : "text-amber-200/80 hover:bg-amber-900/40"}`}
        >
          Results
        </button>
      </div>

      {tab === "reveals" && (
        <div className="space-y-4">
          <p className="text-amber-200/80 text-sm">Map beer numbers to actual names. Only you see this until you share results.</p>
          <form onSubmit={addReveal} className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-amber-200/70 text-xs mb-0.5">#</label>
              <input
                type="number"
                min={1}
                max={beerCount}
                value={newBeerNumber}
                onChange={(e) => setNewBeerNumber(parseInt(e.target.value, 10) || 1)}
                className="w-14 rounded bg-amber-900/40 border border-amber-700/50 text-amber-100 px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-amber-200/70 text-xs mb-0.5">Beer name</label>
              <input
                type="text"
                value={newBeerName}
                onChange={(e) => setNewBeerName(e.target.value)}
                placeholder="Beer name"
                className="w-full rounded bg-amber-900/40 border border-amber-700/50 text-amber-100 px-2 py-1.5 text-sm"
              />
            </div>
            <div className="min-w-[100px]">
              <label className="block text-amber-200/70 text-xs mb-0.5">Brewery</label>
              <input
                type="text"
                value={newBrewery}
                onChange={(e) => setNewBrewery(e.target.value)}
                placeholder="Optional"
                className="w-full rounded bg-amber-900/40 border border-amber-700/50 text-amber-100 px-2 py-1.5 text-sm"
              />
            </div>
            <div className="min-w-[80px]">
              <label className="block text-amber-200/70 text-xs mb-0.5">Style</label>
              <input
                type="text"
                value={newStyle}
                onChange={(e) => setNewStyle(e.target.value)}
                placeholder="e.g. IPA"
                className="w-full rounded bg-amber-900/40 border border-amber-700/50 text-amber-100 px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !newBeerName.trim()}
              className="rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-amber-950 font-medium px-3 py-1.5 text-sm"
            >
              Add
            </button>
          </form>
          <ul className="space-y-2">
            {reveals.map((r) => (
              <li key={r.id} className="flex items-center gap-2 flex-wrap rounded-lg bg-amber-900/30 border border-amber-700/40 px-3 py-2">
                <span className="font-mono text-amber-400 w-6">#{r.beer_number}</span>
                <span className="font-medium text-amber-200">{r.beer_name}</span>
                {r.brewery && <span className="text-amber-200/70 text-sm">{r.brewery}</span>}
                {r.style && <span className="text-amber-500 text-sm">{r.style}</span>}
                <button
                  type="button"
                  onClick={() => deleteReveal(r.id)}
                  className="ml-auto text-red-400 hover:text-red-300 text-sm"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "players" && (
        <ul className="space-y-2">
          {players.length === 0 ? (
            <p className="text-amber-200/70">No players yet. Share the code: <span className="font-mono font-semibold">{code}</span></p>
          ) : (
            players.map((p) => (
              <li key={p.id} className="rounded-lg bg-amber-900/30 border border-amber-700/40 px-3 py-2 flex justify-between items-center">
                <span className="text-amber-200 font-medium">{p.name}</span>
                <span className="text-amber-200/60 text-sm">{p.order_direction === "ascending" ? "1 → last" : "Last → 1"}</span>
              </li>
            ))
          )}
        </ul>
      )}

      {tab === "results" && (
        <div className="space-y-6">
          <p className="text-amber-200/80 text-sm">Ratings per player. Use Beer reveals to see which number is which beer.</p>
          <div className="space-y-4">
            {ratingsByPlayer.map(({ player, ratings: rs }) => (
              <div key={player.id} className="rounded-lg bg-amber-900/30 border border-amber-700/40 overflow-hidden">
                <div className="px-3 py-2 border-b border-amber-700/40 font-medium text-amber-200">
                  {player.name}
                </div>
                <div className="divide-y divide-amber-800/40">
                  {rs.length === 0 ? (
                    <div className="px-3 py-2 text-amber-200/60 text-sm">No ratings yet</div>
                  ) : (
                    rs
                      .sort((a, b) => a.beer_number - b.beer_number)
                      .map((r) => {
                        const rev = reveals.find((x) => x.beer_number === r.beer_number);
                        return (
                          <div key={r.id} className="px-3 py-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            <span className="font-mono text-amber-400">Beer #{r.beer_number}</span>
                            {rev && <span className="text-amber-300">{rev.beer_name}</span>}
                            <span>Crush: {r.crushability ?? "—"}</span>
                            <span>Taste: {r.taste ?? "—"}</span>
                            {r.guess && <span>Guess: {r.guess}</span>}
                            {r.notes && <span className="text-amber-200/80">Notes: {r.notes}</span>}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
