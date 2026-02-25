"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
  const [tab, setTab] = useState<"reveals" | "players" | "results">("reveals");
  const [resultsReveals, setResultsReveals] = useState<BeerReveal[]>([]);
  const [resultsPlayers, setResultsPlayers] = useState<Player[]>([]);
  const [resultsRatings, setResultsRatings] = useState<Rating[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
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
  }, [sessionId]);

  const fetchResultsData = useCallback(async () => {
    setResultsLoading(true);
    const supabase = createSupabaseClient();
    const [revRes, playRes, ratRes] = await Promise.all([
      supabase.from("beer_reveals").select("*").eq("session_id", sessionId).order("beer_number"),
      supabase.from("players").select("*").eq("session_id", sessionId),
      supabase.from("ratings").select("*").eq("session_id", sessionId),
    ]);
    setResultsReveals(revRes.data ?? []);
    setResultsPlayers(playRes.data ?? []);
    setResultsRatings(ratRes.data ?? []);
    setResultsLoading(false);
  }, [sessionId]);

  useEffect(() => {
    if (tab === "results") fetchResultsData();
  }, [tab, fetchResultsData]);

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

  const leaderboard = useMemo(() => {
    const countByPlayer = new Map<string, number>();
    resultsRatings.forEach((r) => countByPlayer.set(r.player_id, (countByPlayer.get(r.player_id) ?? 0) + 1));
    return resultsPlayers
      .map((p) => ({ player: p, count: countByPlayer.get(p.id) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [resultsPlayers, resultsRatings]);

  const resultsByBeer = useMemo(() => {
    const out: { beerNumber: number; name: string | null; ratings: Rating[]; avgCrush: number; avgTaste: number }[] = [];
    for (let n = 1; n <= beerCount; n++) {
      const beerRatings = resultsRatings.filter((r) => r.beer_number === n);
      const withScores = beerRatings.filter((r) => r.crushability != null && r.taste != null);
      const avgCrush = withScores.length ? withScores.reduce((s, r) => s + (r.crushability ?? 0), 0) / withScores.length : 0;
      const avgTaste = withScores.length ? withScores.reduce((s, r) => s + (r.taste ?? 0), 0) / withScores.length : 0;
      const rev = resultsReveals.find((r) => r.beer_number === n);
      out.push({
        beerNumber: n,
        name: rev?.beer_name ?? null,
        ratings: beerRatings,
        avgCrush,
        avgTaste,
      });
    }
    return out;
  }, [beerCount, resultsRatings, resultsReveals]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--amber-light)]">{sessionName}</h1>
          <p className="text-[var(--amber-muted)] text-sm">Code: <span className="font-mono">{code}</span> · Share this so players can join</p>
        </div>
        <Link href="/" className="text-[var(--amber-muted)] hover:text-[var(--amber-warm)] text-sm">
          Home
        </Link>
      </div>

      <div className="flex gap-2 mb-6 border-b border-[var(--amber-border)] pb-2">
        <button
          type="button"
          onClick={() => setTab("reveals")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "reveals" ? "bg-[var(--amber-gold)] text-[var(--amber-darker)]" : "text-[var(--amber-light)]/80 hover:bg-[var(--amber-darker)]"}`}
        >
          Beer reveals
        </button>
        <button
          type="button"
          onClick={() => setTab("players")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "players" ? "bg-[var(--amber-gold)] text-[var(--amber-darker)]" : "text-[var(--amber-light)]/80 hover:bg-[var(--amber-darker)]"}`}
        >
          Players ({players.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("results")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "results" ? "bg-[var(--amber-gold)] text-[var(--amber-darker)]" : "text-[var(--amber-light)]/80 hover:bg-[var(--amber-darker)]"}`}
        >
          Results
        </button>
      </div>

      {tab === "reveals" && (
        <div className="space-y-4">
          <p className="text-[var(--amber-muted)] text-sm">Map beer numbers to actual names. Only you see this until you share results.</p>
          <form onSubmit={addReveal} className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-[var(--amber-muted)] text-xs mb-0.5">#</label>
              <input
                type="number"
                min={1}
                max={beerCount}
                value={newBeerNumber}
                onChange={(e) => setNewBeerNumber(parseInt(e.target.value, 10) || 1)}
                className="w-14 rounded bg-[var(--amber-darker)] border-2 border-[var(--amber-border)] text-[var(--amber-light)] px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[var(--amber-muted)] text-xs mb-0.5">Beer name</label>
              <input
                type="text"
                value={newBeerName}
                onChange={(e) => setNewBeerName(e.target.value)}
                placeholder="Beer name"
                className="w-full rounded bg-[var(--amber-darker)] border-2 border-[var(--amber-border)] text-[var(--amber-light)] px-2 py-1.5 text-sm"
              />
            </div>
            <div className="min-w-[100px]">
              <label className="block text-[var(--amber-muted)] text-xs mb-0.5">Brewery</label>
              <input
                type="text"
                value={newBrewery}
                onChange={(e) => setNewBrewery(e.target.value)}
                placeholder="Optional"
                className="w-full rounded bg-[var(--amber-darker)] border-2 border-[var(--amber-border)] text-[var(--amber-light)] px-2 py-1.5 text-sm"
              />
            </div>
            <div className="min-w-[80px]">
              <label className="block text-[var(--amber-muted)] text-xs mb-0.5">Style</label>
              <input
                type="text"
                value={newStyle}
                onChange={(e) => setNewStyle(e.target.value)}
                placeholder="e.g. IPA"
                className="w-full rounded bg-[var(--amber-darker)] border-2 border-[var(--amber-border)] text-[var(--amber-light)] px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !newBeerName.trim()}
              className="rounded-lg bg-[var(--amber-gold)] hover:bg-[var(--amber-warm)] disabled:opacity-50 text-[var(--amber-darker)] font-medium px-3 py-1.5 text-sm"
            >
              Add
            </button>
          </form>
          <ul className="space-y-2">
            {reveals.map((r) => (
              <li key={r.id} className="flex items-center gap-2 flex-wrap rounded-lg bg-[var(--amber-darker)] border border-[var(--amber-border)] px-3 py-2">
                <span className="font-mono text-[var(--amber-gold)] w-6">#{r.beer_number}</span>
                <span className="font-medium text-[var(--amber-light)]">{r.beer_name}</span>
                {r.brewery && <span className="text-[var(--amber-muted)] text-sm">{r.brewery}</span>}
                {r.style && <span className="text-[var(--amber-warm)] text-sm">{r.style}</span>}
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
            <p className="text-[var(--amber-muted)]">No players yet. Share the code: <span className="font-mono font-semibold">{code}</span></p>
          ) : (
            players.map((p) => (
              <li key={p.id} className="rounded-lg bg-[var(--amber-darker)] border border-[var(--amber-border)] px-3 py-2 flex justify-between items-center">
                <span className="text-[var(--amber-light)] font-medium">{p.name}</span>
                <span className="text-[var(--amber-muted)] text-sm">{p.order_direction === "ascending" ? "1 → last" : "Last → 1"}</span>
              </li>
            ))
          )}
        </ul>
      )}

      {tab === "results" && (
        <div className="space-y-8">
          {resultsLoading ? (
            <p className="text-[var(--amber-muted)]">Loading results…</p>
          ) : (
            <>
              <section>
                <h2 className="text-lg font-bold text-[var(--amber-light)] mb-3">Leaderboard — who&apos;s done</h2>
                <p className="text-[var(--amber-muted)] text-sm mb-3">Players by number of ratings submitted.</p>
                <ul className="rounded-lg bg-[var(--amber-darker)] border border-[var(--amber-border)] overflow-hidden divide-y divide-[var(--amber-border)]">
                  {leaderboard.length === 0 ? (
                    <li className="px-3 py-2 text-[var(--amber-muted)] text-sm">No ratings yet</li>
                  ) : (
                    leaderboard.map(({ player, count }, idx) => (
                      <li key={player.id} className="px-3 py-2 flex justify-between items-center">
                        <span className="text-[var(--amber-light)] font-medium">
                          {idx + 1}. {player.name}
                        </span>
                        <span className="text-[var(--amber-gold)] font-mono">{count} / {beerCount}</span>
                      </li>
                    ))
                  )}
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-bold text-[var(--amber-light)] mb-3">Ratings by beer</h2>
                <div className="space-y-6">
                  {resultsByBeer.map(({ beerNumber, name, ratings: beerRatings, avgCrush, avgTaste }) => {
                    const playerMap = new Map(resultsPlayers.map((p) => [p.id, p]));
                    return (
                      <div key={beerNumber} className="rounded-lg bg-[var(--amber-darker)] border border-[var(--amber-border)] overflow-hidden">
                        <div className="px-3 py-2 border-b border-[var(--amber-border)] flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="font-mono font-bold text-[var(--amber-gold)]">Beer #{beerNumber}</span>
                          {name && <span className="text-[var(--amber-light)]">{name}</span>}
                          <span className="text-[var(--amber-muted)] text-sm">
                            Avg crush: {beerRatings.length ? avgCrush.toFixed(1) : "—"} · Avg taste: {beerRatings.length ? avgTaste.toFixed(1) : "—"} · {beerRatings.length} rating{beerRatings.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-[var(--amber-muted)] border-b border-[var(--amber-border)]">
                                <th className="px-3 py-2 font-medium">Player</th>
                                <th className="px-3 py-2 font-medium">Crush</th>
                                <th className="px-3 py-2 font-medium">Taste</th>
                                <th className="px-3 py-2 font-medium">Guess</th>
                                <th className="px-3 py-2 font-medium">Notes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--amber-border)]/60">
                              {beerRatings.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-3 py-2 text-[var(--amber-muted)]">No ratings yet</td>
                                </tr>
                              ) : (
                                beerRatings.map((r) => (
                                  <tr key={r.id} className="text-[var(--amber-light)]">
                                    <td className="px-3 py-2 font-medium">{playerMap.get(r.player_id)?.name ?? "—"}</td>
                                    <td className="px-3 py-2">{r.crushability ?? "—"}</td>
                                    <td className="px-3 py-2">{r.taste ?? "—"}</td>
                                    <td className="px-3 py-2 max-w-[120px] truncate" title={r.guess ?? ""}>{r.guess ?? "—"}</td>
                                    <td className="px-3 py-2 max-w-[140px] truncate" title={r.notes ?? ""}>{r.notes ?? "—"}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
