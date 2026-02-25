"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";
import type { BeerReveal, Player, Rating } from "@/types/database";

type ResultsSection = "overall" | "taste" | "crush" | "guesses" | "chart" | "individual";

type BeerStat = {
  beerNumber: number;
  name: string | null;
  ratings: Rating[];
  avgCrush: number;
  avgTaste: number;
  combined: number;
};

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
  const [resultsSection, setResultsSection] = useState<ResultsSection>("overall");
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

  const resultsByBeer = useMemo((): BeerStat[] => {
    const out: BeerStat[] = [];
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
        combined: (avgCrush + avgTaste) / 2,
      });
    }
    return out;
  }, [beerCount, resultsRatings, resultsReveals]);

  const overallRanked = useMemo(() => [...resultsByBeer].sort((a, b) => b.combined - a.combined), [resultsByBeer]);
  const tasteRanked = useMemo(() => [...resultsByBeer].sort((a, b) => b.avgTaste - a.avgTaste), [resultsByBeer]);
  const crushRanked = useMemo(() => [...resultsByBeer].sort((a, b) => b.avgCrush - a.avgCrush), [resultsByBeer]);

  const revealByNumber = useMemo(() => new Map(resultsReveals.map((r) => [r.beer_number, r])), [resultsReveals]);
  const guessAccuracy = useMemo(() => {
    return resultsPlayers.map((player) => {
      const playerRatings = resultsRatings.filter((r) => r.player_id === player.id && r.guess && r.guess.trim() !== "");
      let correct = 0;
      for (const r of playerRatings) {
        const rev = revealByNumber.get(r.beer_number);
        if (rev?.beer_name && r.guess && rev.beer_name.trim().toLowerCase() === r.guess.trim().toLowerCase()) correct++;
      }
      return { player, total: playerRatings.length, correct };
    }).filter((x) => x.total > 0).sort((a, b) => (b.correct / b.total) - (a.correct / a.total));
  }, [resultsPlayers, resultsRatings, revealByNumber]);

  const sections: { id: ResultsSection; label: string }[] = [
    { id: "overall", label: "Overall" },
    { id: "taste", label: "Taste" },
    { id: "crush", label: "Crushability" },
    { id: "guesses", label: "Guess accuracy" },
    { id: "chart", label: "Score chart" },
    { id: "individual", label: "Individual ratings" },
  ];

  function BeerRankTable({ rows, sortLabel }: { rows: BeerStat[]; sortLabel: string }) {
    return (
      <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-amber)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--progress-track)] text-left text-[var(--text-muted)]">
              <th className="px-3 py-2 font-medium">Rank</th>
              <th className="px-3 py-2 font-medium">Beer</th>
              <th className="px-3 py-2 font-medium">{sortLabel}</th>
              <th className="px-3 py-2 font-medium">Avg crush</th>
              <th className="px-3 py-2 font-medium">Avg taste</th>
              <th className="px-3 py-2 font-medium">Ratings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {rows.map((row, idx) => (
              <tr
                key={row.beerNumber}
                className={idx === 0 ? "bg-amber-100/60" : ""}
              >
                <td className="px-3 py-2">
                  {idx === 0 ? <span title="Top beer">👑</span> : null} #{idx + 1}
                </td>
                <td className="px-3 py-2 font-medium text-[var(--text-heading)]">
                  Beer #{row.beerNumber}{row.name ? ` · ${row.name}` : ""}
                </td>
                <td className="px-3 py-2 font-semibold text-[var(--amber-gold)]">
                  {row.ratings.length ? (sortLabel === "Combined" ? row.combined.toFixed(1) : sortLabel === "Avg taste" ? row.avgTaste.toFixed(1) : row.avgCrush.toFixed(1)) : "—"}
                </td>
                <td className="px-3 py-2">{row.ratings.length ? row.avgCrush.toFixed(1) : "—"}</td>
                <td className="px-3 py-2">{row.ratings.length ? row.avgTaste.toFixed(1) : "—"}</td>
                <td className="px-3 py-2">{row.ratings.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-heading)]">{sessionName}</h1>
          <p className="text-[var(--text-muted)] text-sm">Code: <span className="font-mono">{code}</span> · Share this so players can join</p>
        </div>
        <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--amber-gold)] text-sm">
          Home
        </Link>
      </div>

      <div className="flex gap-2 mb-6 border-b border-[var(--border-amber)] pb-2">
        <button
          type="button"
          onClick={() => setTab("reveals")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "reveals" ? "bg-[var(--amber-gold)] text-[var(--button-text)]" : "text-[var(--text-muted)] hover:bg-amber-100"}`}
        >
          Beer reveals
        </button>
        <button
          type="button"
          onClick={() => setTab("players")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "players" ? "bg-[var(--amber-gold)] text-[var(--button-text)]" : "text-[var(--text-muted)] hover:bg-amber-100"}`}
        >
          Players ({players.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("results")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "results" ? "bg-[var(--amber-gold)] text-[var(--button-text)]" : "text-[var(--text-muted)] hover:bg-amber-100"}`}
        >
          Results
        </button>
      </div>

      {tab === "reveals" && (
        <div className="space-y-4">
          <p className="text-[var(--text-muted)] text-sm">Map beer numbers to actual names. Only you see this until you share results.</p>
          <form onSubmit={addReveal} className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-[var(--text-muted)] text-xs mb-0.5">#</label>
              <input
                type="number"
                min={1}
                max={beerCount}
                value={newBeerNumber}
                onChange={(e) => setNewBeerNumber(parseInt(e.target.value, 10) || 1)}
                className="w-14 rounded bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[var(--text-muted)] text-xs mb-0.5">Beer name</label>
              <input
                type="text"
                value={newBeerName}
                onChange={(e) => setNewBeerName(e.target.value)}
                placeholder="Beer name"
                className="w-full rounded bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-2 py-1.5 text-sm"
              />
            </div>
            <div className="min-w-[100px]">
              <label className="block text-[var(--text-muted)] text-xs mb-0.5">Brewery</label>
              <input
                type="text"
                value={newBrewery}
                onChange={(e) => setNewBrewery(e.target.value)}
                placeholder="Optional"
                className="w-full rounded bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-2 py-1.5 text-sm"
              />
            </div>
            <div className="min-w-[80px]">
              <label className="block text-[var(--text-muted)] text-xs mb-0.5">Style</label>
              <input
                type="text"
                value={newStyle}
                onChange={(e) => setNewStyle(e.target.value)}
                placeholder="e.g. IPA"
                className="w-full rounded bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !newBeerName.trim()}
              className="rounded-lg bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] disabled:opacity-50 text-[var(--button-text)] font-medium px-3 py-1.5 text-sm"
            >
              Add
            </button>
          </form>
          <ul className="space-y-2">
            {reveals.map((r) => (
              <li key={r.id} className="flex items-center gap-2 flex-wrap rounded-lg bg-[var(--bg-card)] border border-[var(--border-amber)] px-3 py-2">
                <span className="font-mono text-[var(--amber-gold)] w-6">#{r.beer_number}</span>
                <span className="font-medium text-[var(--text-heading)]">{r.beer_name}</span>
                {r.brewery && <span className="text-[var(--text-muted)] text-sm">{r.brewery}</span>}
                {r.style && <span className="text-amber-600 text-sm">{r.style}</span>}
                <button
                  type="button"
                  onClick={() => deleteReveal(r.id)}
                  className="ml-auto text-red-600 hover:text-red-700 text-sm"
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
            <p className="text-[var(--text-muted)]">No players yet. Share the code: <span className="font-mono font-semibold">{code}</span></p>
          ) : (
            players.map((p) => (
              <li key={p.id} className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-amber)] px-3 py-2 flex justify-between items-center">
                <span className="text-[var(--text-heading)] font-medium">{p.name}</span>
                <span className="text-[var(--text-muted)] text-sm">{p.order_direction === "ascending" ? "1 → last" : "Last → 1"}</span>
              </li>
            ))
          )}
        </ul>
      )}

      {tab === "results" && (
        <div className="space-y-6">
          {resultsLoading ? (
            <p className="text-[var(--text-muted)]">Loading results…</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 border-b border-[var(--border-amber)] pb-3">
                {sections.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setResultsSection(id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${resultsSection === id ? "bg-[var(--amber-gold)] text-[var(--button-text)]" : "bg-[var(--bg-card)] border border-[var(--border-amber)] text-[var(--text-muted)] hover:bg-amber-50"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {resultsSection === "overall" && (
                <section>
                  <h2 className="text-lg font-bold text-[var(--text-heading)] mb-3">Overall leaderboard</h2>
                  <p className="text-[var(--text-muted)] text-sm mb-3">Beers ranked by combined score (avg crush + avg taste) / 2</p>
                  <BeerRankTable rows={overallRanked} sortLabel="Combined" />
                </section>
              )}

              {resultsSection === "taste" && (
                <section>
                  <h2 className="text-lg font-bold text-[var(--text-heading)] mb-3">Taste rankings</h2>
                  <p className="text-[var(--text-muted)] text-sm mb-3">Beers ranked by average taste score</p>
                  <BeerRankTable rows={tasteRanked} sortLabel="Avg taste" />
                </section>
              )}

              {resultsSection === "crush" && (
                <section>
                  <h2 className="text-lg font-bold text-[var(--text-heading)] mb-3">Crushability rankings</h2>
                  <p className="text-[var(--text-muted)] text-sm mb-3">Beers ranked by average crushability score</p>
                  <BeerRankTable rows={crushRanked} sortLabel="Avg crush" />
                </section>
              )}

              {resultsSection === "guesses" && (
                <section>
                  <h2 className="text-lg font-bold text-[var(--text-heading)] mb-3">Guess accuracy leaderboard</h2>
                  <p className="text-[var(--text-muted)] text-sm mb-3">Players ranked by how many guesses matched the revealed beer name (case-insensitive)</p>
                  <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-amber)] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[var(--progress-track)] text-left text-[var(--text-muted)]">
                          <th className="px-3 py-2 font-medium">#</th>
                          <th className="px-3 py-2 font-medium">Player</th>
                          <th className="px-3 py-2 font-medium">Correct / Total</th>
                          <th className="px-3 py-2 font-medium">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {guessAccuracy.length === 0 ? (
                          <tr><td colSpan={4} className="px-3 py-2 text-[var(--text-muted)]">No guesses to score yet</td></tr>
                        ) : (
                          guessAccuracy.map(({ player, correct, total }, idx) => (
                            <tr key={player.id}>
                              <td className="px-3 py-2">{idx + 1}</td>
                              <td className="px-3 py-2 font-medium text-[var(--text-heading)]">{player.name}</td>
                              <td className="px-3 py-2">{correct} / {total}</td>
                              <td className="px-3 py-2 font-semibold text-[var(--amber-gold)]">{total ? ((100 * correct) / total).toFixed(0) : 0}%</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {resultsSection === "chart" && (
                <section>
                  <h2 className="text-lg font-bold text-[var(--text-heading)] mb-3">Beer score comparison</h2>
                  <p className="text-[var(--text-muted)] text-sm mb-2">Horizontal bars: first segment = taste (amber), second = crushability (gold). Scale 0–10.</p>
                  <p className="text-[var(--text-muted)] text-xs mb-4">Legend: T = Taste, C = Crushability</p>
                  <div className="space-y-3">
                    {resultsByBeer.map((row) => {
                      const tastePct = Math.min(100, (row.avgTaste / 10) * 50);
                      const crushPct = Math.min(100, (row.avgCrush / 10) * 50);
                      return (
                        <div key={row.beerNumber} className="flex items-center gap-3">
                          <div className="w-24 shrink-0 text-sm font-medium text-[var(--text-heading)]">
                            #{row.beerNumber}{row.name ? ` ${row.name}` : ""}
                          </div>
                          <div className="flex-1 h-8 rounded overflow-hidden bg-[var(--progress-track)] flex">
                            <div
                              className="h-full bg-amber-500 transition-all"
                              style={{ width: `${tastePct}%` }}
                              title={`Taste: ${row.avgTaste.toFixed(1)}`}
                            />
                            <div
                              className="h-full bg-[var(--amber-gold)] transition-all"
                              style={{ width: `${crushPct}%` }}
                              title={`Crush: ${row.avgCrush.toFixed(1)}`}
                            />
                          </div>
                          <span className="w-16 text-right text-sm text-[var(--text-muted)]">
                            T {row.ratings.length ? row.avgTaste.toFixed(1) : "—"} · C {row.ratings.length ? row.avgCrush.toFixed(1) : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {resultsSection === "individual" && (
                <section>
                  <h2 className="text-lg font-bold text-[var(--text-heading)] mb-3">Individual ratings by beer</h2>
                  <div className="space-y-6">
                    {resultsByBeer.map(({ beerNumber, name, ratings: beerRatings, avgCrush, avgTaste }) => {
                      const playerMap = new Map(resultsPlayers.map((p) => [p.id, p]));
                      return (
                        <div key={beerNumber} className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-amber)] overflow-hidden">
                          <div className="px-3 py-2 border-b border-[var(--border-subtle)] flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-[var(--progress-track)]">
                            <span className="font-mono font-bold text-[var(--amber-gold)]">Beer #{beerNumber}</span>
                            {name && <span className="text-[var(--text-heading)]">{name}</span>}
                            <span className="text-[var(--text-muted)] text-sm">
                              Avg crush: {beerRatings.length ? avgCrush.toFixed(1) : "—"} · Avg taste: {beerRatings.length ? avgTaste.toFixed(1) : "—"} · {beerRatings.length} rating{beerRatings.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                                  <th className="px-3 py-2 font-medium">Player</th>
                                  <th className="px-3 py-2 font-medium">Crush</th>
                                  <th className="px-3 py-2 font-medium">Taste</th>
                                  <th className="px-3 py-2 font-medium">Guess</th>
                                  <th className="px-3 py-2 font-medium">Notes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border-subtle)]">
                                {beerRatings.length === 0 ? (
                                  <tr>
                                    <td colSpan={5} className="px-3 py-2 text-[var(--text-muted)]">No ratings yet</td>
                                  </tr>
                                ) : (
                                  beerRatings.map((r) => (
                                    <tr key={r.id} className="text-[var(--text-body)]">
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
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
