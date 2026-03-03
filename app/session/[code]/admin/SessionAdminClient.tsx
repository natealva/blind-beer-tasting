"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseClient } from "@/lib/supabase";
import { BEER_GIFS, getRandomBeerGif } from "@/lib/beerGifs";
import { getCriteria, getCriterionScore, getOverallScore } from "@/lib/criteriaUtils";
import type { BeerReveal, Player, Rating } from "@/types/database";
import type { Criterion } from "@/lib/types";
import { ScorecardsContent } from "../scorecards/ScorecardsContent";

const DEFAULT_CRITERIA: Criterion[] = [
  { id: "taste", label: "Taste", emoji: "👅" },
  { id: "crushability", label: "Crushability", emoji: "🍺" },
];

type ResultsSection = "overall" | "guesses" | "individual" | string;

type BeerStat = {
  beerNumber: number;
  name: string | null;
  ratings: Rating[];
  combined: number;
  avgByCriterion: Record<string, number>;
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
  const [tab, setTab] = useState<"reveals" | "criteria" | "players" | "results" | "scorecards">("reveals");
  const [resultsSection, setResultsSection] = useState<ResultsSection>("overall");
  const [resultsReveals, setResultsReveals] = useState<BeerReveal[]>([]);
  const [resultsPlayers, setResultsPlayers] = useState<Player[]>([]);
  const [resultsRatings, setResultsRatings] = useState<Rating[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [playersTabPlayers, setPlayersTabPlayers] = useState<Player[]>([]);
  const [playersTabRatings, setPlayersTabRatings] = useState<Rating[]>([]);
  const [playersTabLoading, setPlayersTabLoading] = useState(false);
  const [newBeerNumber, setNewBeerNumber] = useState(1);
  const [newBeerName, setNewBeerName] = useState("");
  const [saving, setSaving] = useState(false);
  const [criteria, setCriteria] = useState<Criterion[]>(DEFAULT_CRITERIA);
  const [criteriaSaved, setCriteriaSaved] = useState(false);
  const [savingCriteria, setSavingCriteria] = useState(false);
  const [gifSrc, setGifSrc] = useState(BEER_GIFS[0]);
  const [editingRating, setEditingRating] = useState<Rating | null>(null);
  const [editForm, setEditForm] = useState<{ criteriaScores: Record<string, number>; guess: string; notes: string }>({ criteriaScores: {}, guess: "", notes: "" });
  const [savingRating, setSavingRating] = useState(false);
  const [scorecardsReveals, setScorecardsReveals] = useState<BeerReveal[]>([]);
  const [scorecardsPlayers, setScorecardsPlayers] = useState<Player[]>([]);
  const [scorecardsRatings, setScorecardsRatings] = useState<Rating[]>([]);
  const [scorecardsLoading, setScorecardsLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  useEffect(() => {
    setGifSrc(getRandomBeerGif());
  }, []);

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
      .from("sessions")
      .select("criteria")
      .eq("id", sessionId)
      .single()
      .then(({ data }) => {
        const c = getCriteria(data);
        if (c.length >= 2) setCriteria(c);
      });
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

  const fetchPlayersTabData = useCallback(async () => {
    setPlayersTabLoading(true);
    const supabase = createSupabaseClient();
    const [playRes, ratRes] = await Promise.all([
      supabase.from("players").select("*").eq("session_id", sessionId).order("created_at", { ascending: true }),
      supabase.from("ratings").select("*").eq("session_id", sessionId),
    ]);
    setPlayersTabPlayers(playRes.data ?? []);
    setPlayersTabRatings(ratRes.data ?? []);
    setPlayersTabLoading(false);
  }, [sessionId]);

  useEffect(() => {
    if (tab === "players") fetchPlayersTabData();
  }, [tab, fetchPlayersTabData]);

  const fetchScorecardsData = useCallback(async () => {
    setScorecardsLoading(true);
    const supabase = createSupabaseClient();
    const [revRes, playRes, ratRes] = await Promise.all([
      supabase.from("beer_reveals").select("*").eq("session_id", sessionId).order("beer_number"),
      supabase.from("players").select("*").eq("session_id", sessionId).order("created_at", { ascending: true }),
      supabase.from("ratings").select("*").eq("session_id", sessionId),
    ]);
    setScorecardsReveals(revRes.data ?? []);
    setScorecardsPlayers(playRes.data ?? []);
    setScorecardsRatings(ratRes.data ?? []);
    setScorecardsLoading(false);
  }, [sessionId]);

  useEffect(() => {
    if (tab === "scorecards") fetchScorecardsData();
  }, [tab, fetchScorecardsData]);

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
    setNewBeerNumber(num + 1);
    setSaving(false);
  }

  function labelToId(label: string): string {
    return label
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "") || "criterion";
  }

  function updateCriterion(index: number, updates: Partial<Criterion>) {
    setCriteria((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      const merged = { ...current, ...updates };
      if (updates.label !== undefined) merged.id = labelToId(updates.label) || current.id;
      next[index] = merged;
      return next;
    });
  }

  function addCriterion() {
    if (criteria.length >= 5) return;
    setCriteria((prev) => [...prev, { id: "new", label: "", emoji: "" }]);
  }

  function removeCriterion(index: number) {
    if (criteria.length <= 2) return;
    setCriteria((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveCriteria() {
    const invalid = criteria.some((c) => !c.label.trim());
    if (invalid) return;
    setSavingCriteria(true);
    setCriteriaSaved(false);
    const toSave = criteria.map((c) => ({
      id: c.id && c.id !== "new" ? c.id : labelToId(c.label) || "criterion",
      label: c.label.trim(),
      emoji: (c.emoji.trim() || "•").slice(0, 1),
    }));
    const supabase = createSupabaseClient();
    await supabase.from("sessions").update({ criteria: toSave }).eq("id", sessionId);
    setCriteria(toSave);
    setCriteriaSaved(true);
    setSavingCriteria(false);
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
    ...criteria.map((c) => ({ id: c.id as ResultsSection, label: c.label })),
    { id: "guesses", label: "Guess accuracy" },
    { id: "individual", label: "Individual ratings" },
  ];

  const CHART_HEIGHT = 200;
  const BAR_WIDTH = 44;

  function pxFromScore(score: number): number {
    return Math.max(0, (score / 10) * CHART_HEIGHT);
  }

  function ResultsBarChart({
    rows,
    getValue,
    barColor,
  }: {
    rows: BeerStat[];
    getValue: (row: BeerStat) => number;
    barColor: string;
  }) {
    const labelText = (row: BeerStat) => row.name ?? `Beer #${row.beerNumber}`;
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: "4px" }} className="-mx-1 pb-2">
        <div style={{ position: "relative", height: "200px", width: "28px", flexShrink: 0 }}>
          {[10, 8, 6, 4, 2, 0].map((val, i) => (
            <span key={val} style={{ position: "absolute", top: `${i * 40}px`, right: "2px", transform: "translateY(-50%)", fontSize: "11px", color: "#92400e" }}>{val}</span>
          ))}
        </div>
        <div style={{ overflowX: "auto", borderLeft: "1px solid #d97706", borderBottom: "1px solid #d97706", flexGrow: 1 }}>
          <div style={{ display: "inline-flex", flexDirection: "column", minWidth: "100%" }}>
            <div style={{ position: "relative", height: "200px", display: "flex", alignItems: "flex-end", gap: "12px", padding: "0 8px" }}>
              {[0, 40, 80, 120, 160].map((topPx) => (
                <div key={topPx} style={{ position: "absolute", top: `${topPx}px`, left: 0, right: 0, height: "1px", background: "rgba(217,119,6,0.15)", pointerEvents: "none" }} />
              ))}
              {rows.map((row) => {
                const score = row.ratings.length ? getValue(row) : 0;
                const barHeightPx = pxFromScore(score);
                return (
                  <div
                    key={row.beerNumber}
                    className={`rounded-t ${barColor}`}
                    style={{ height: `${barHeightPx}px`, width: `${BAR_WIDTH}px`, minHeight: barHeightPx > 0 ? 2 : 0, flexShrink: 0 }}
                    title={row.ratings.length ? `${score.toFixed(1)}` : "No ratings"}
                  />
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "12px", padding: "4px 8px 0" }}>
              {rows.map((row) => (
                <div key={row.beerNumber} style={{ width: "44px", fontSize: "10px", textAlign: "center", color: "#92400e", flexShrink: 0, wordBreak: "break-word", lineHeight: "1.2" }}>
                  {labelText(row)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function BeerRankTable({
    rows,
    sortLabel,
    sortKey,
  }: {
    rows: BeerStat[];
    sortLabel: string;
    sortKey: "combined" | string;
  }) {
    const sortValue = (row: BeerStat) =>
      sortKey === "combined" ? row.combined : row.avgByCriterion[sortKey] ?? 0;
    return (
      <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-amber)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--progress-track)] text-left text-[var(--text-muted)]">
              <th className="px-3 py-2 font-medium">Rank</th>
              <th className="px-3 py-2 font-medium">Beer</th>
              <th className="px-3 py-2 font-medium">{sortLabel}</th>
              {criteria.map((c) => (
                <th key={c.id} className="px-3 py-2 font-medium">Avg {c.label}</th>
              ))}
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
                  {row.ratings.length ? sortValue(row).toFixed(1) : "—"}
                </td>
                {criteria.map((c) => (
                  <td key={c.id} className="px-3 py-2">
                    {row.ratings.length ? (row.avgByCriterion[c.id] ?? 0).toFixed(1) : "—"}
                  </td>
                ))}
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
        <div className="flex items-center gap-3">
          <Image
            src={gifSrc}
            alt="Beer cheers"
            width={80}
            height={80}
            unoptimized
            className="rounded-lg shrink-0"
          />
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-heading)]">{sessionName}</h1>
            <p className="text-[var(--text-muted)] text-sm">Code: <span className="font-mono">{code}</span> · Share this so players can join</p>
          </div>
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
          onClick={() => setTab("criteria")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "criteria" ? "bg-[var(--amber-gold)] text-[var(--button-text)]" : "text-[var(--text-muted)] hover:bg-amber-100"}`}
        >
          Criteria
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
        <button
          type="button"
          onClick={() => setTab("scorecards")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "scorecards" ? "bg-[var(--amber-gold)] text-[var(--button-text)]" : "text-[var(--text-muted)] hover:bg-amber-100"}`}
        >
          Scorecards
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

      {tab === "criteria" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--text-heading)]">Rating Criteria</h2>
          <p className="text-[var(--text-muted)] text-sm">Customize what players rate each beer on. Default is Taste and Crushability.</p>
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800 text-sm">
            ⚠️ Change criteria before players start rating for best results
          </div>
          <div className="space-y-2">
            {criteria.map((c, index) => (
              <div key={index} className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={c.emoji}
                  onChange={(e) => updateCriterion(index, { emoji: e.target.value })}
                  placeholder="👅"
                  maxLength={1}
                  className="rounded bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-2 py-1.5 text-xl text-center w-12"
                  style={{ width: "48px" }}
                />
                <input
                  type="text"
                  value={c.label}
                  onChange={(e) => updateCriterion(index, { label: e.target.value })}
                  placeholder="e.g. Taste"
                  className="flex-1 min-w-[120px] rounded bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-2 py-1.5 text-sm"
                />
                {criteria.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeCriterion(index)}
                    className="text-red-600 hover:text-red-700 p-1.5 rounded"
                    title="Remove"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {criteria.length < 5 && (
            <button
              type="button"
              onClick={addCriterion}
              className="rounded-lg bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] font-medium px-3 py-1.5 text-sm hover:bg-amber-50"
            >
              ＋ Add Criterion
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveCriteria}
              disabled={savingCriteria || criteria.some((c) => !c.label.trim())}
              className="rounded-lg bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] disabled:opacity-50 text-[var(--button-text)] font-medium px-3 py-1.5 text-sm"
            >
              Save Criteria
            </button>
            {criteriaSaved && <span className="text-green-700 text-sm font-medium">Criteria saved!</span>}
          </div>
        </div>
      )}

      {tab === "scorecards" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-amber)] p-4">
            <p className="text-[var(--text-muted)] text-sm mb-2">Share this link with participants after the reveal!</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 min-w-0 text-sm text-[var(--text-heading)] bg-[var(--progress-track)] px-2 py-1.5 rounded break-all">
                {typeof window !== "undefined" ? `${window.location.origin}/session/${code}/scorecards` : `/session/${code}/scorecards`}
              </code>
              <button
                type="button"
                onClick={() => {
                  const url = typeof window !== "undefined" ? `${window.location.origin}/session/${code}/scorecards` : "";
                  if (url && navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(url).then(() => {
                      setCopyFeedback(true);
                      setTimeout(() => setCopyFeedback(false), 2000);
                    });
                  }
                }}
                className="shrink-0 rounded-lg bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] text-[var(--button-text)] font-medium px-3 py-1.5 text-sm"
              >
                {copyFeedback ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>
          {scorecardsLoading ? (
            <p className="text-[var(--text-muted)]">Loading scorecards…</p>
          ) : (
            <div className="rounded-xl bg-[var(--background)] border border-[var(--border-amber)] p-4 max-h-[70vh] overflow-y-auto">
              <ScorecardsContent
                sessionName={sessionName}
                reveals={scorecardsReveals}
                players={scorecardsPlayers}
                ratings={scorecardsRatings}
              />
            </div>
          )}
        </div>
      )}

      {tab === "players" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)] text-sm">Live data — fetched when you open this tab</span>
            <button
              type="button"
              onClick={() => fetchPlayersTabData()}
              disabled={playersTabLoading}
              className="rounded-lg bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] disabled:opacity-50 text-[var(--button-text)] font-medium px-3 py-1.5 text-sm"
            >
              {playersTabLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          {playersTabLoading && playersTabPlayers.length === 0 ? (
            <p className="text-[var(--text-muted)]">Loading players…</p>
          ) : playersTabPlayers.length === 0 ? (
            <p className="text-[var(--text-muted)]">No players yet. Share the code: <span className="font-mono font-semibold">{code}</span></p>
          ) : (
            <ul className="space-y-3">
              {playersTabPlayers.map((p) => {
                const ratingCount = playersTabRatings.filter((r) => r.player_id === p.id).length;
                const pct = beerCount > 0 ? (100 * ratingCount) / beerCount : 0;
                const joined = p.created_at ? new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
                return (
                  <li key={p.id} className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-amber)] px-4 py-3">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[var(--text-heading)] font-medium">{p.name}</span>
                      <span className="text-[var(--amber-gold)] font-semibold text-sm">{ratingCount}/{beerCount}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--progress-track)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--amber-gold)] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[var(--text-muted)] text-xs mt-1">Joined {joined}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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
                  <p className="text-[var(--text-muted)] text-sm mb-3">Beers ranked by combined score (average of all criteria)</p>
                  <div className="mb-4">
                    <ResultsBarChart
                      rows={overallRanked}
                      getValue={(row) => row.combined}
                      barColor="bg-amber-500"
                    />
                  </div>
                  <BeerRankTable rows={overallRanked} sortLabel="Combined" sortKey="combined" />
                </section>
              )}

              {rankedByCriterion.map(({ criterion, ranked }) =>
                resultsSection === criterion.id ? (
                  <section key={criterion.id}>
                    <h2 className="text-lg font-bold text-[var(--text-heading)] mb-3">{criterion.label} rankings</h2>
                    <p className="text-[var(--text-muted)] text-sm mb-3">Beers ranked by average {criterion.label.toLowerCase()} score</p>
                    <div className="mb-4">
                      <ResultsBarChart
                        rows={ranked}
                        getValue={(row) => row.avgByCriterion[criterion.id]}
                        barColor="bg-amber-700"
                      />
                    </div>
                    <BeerRankTable rows={ranked} sortLabel={`Avg ${criterion.label}`} sortKey={criterion.id} />
                  </section>
                ) : null
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
                                  <th className="px-3 py-2 w-10"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border-subtle)]">
                                {beerRatings.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="px-3 py-2 text-[var(--text-muted)]">No ratings yet</td>
                                  </tr>
                                ) : (
                                  beerRatings.map((r) => {
                                    const isEditing = editingRating?.id === r.id;
                                    return (
                                      <tr key={r.id} className="text-[var(--text-body)]">
                                        {isEditing ? (
                                          <td colSpan={6} className="px-3 py-2 bg-amber-50/80">
                                            <div className="flex flex-wrap gap-2 items-end">
                                              <div>
                                                <label className="block text-[10px] text-[var(--text-muted)]">Crush</label>
                                                <input
                                                  type="number"
                                                  min={1}
                                                  max={10}
                                                  value={editForm.crushability}
                                                  onChange={(e) => setEditForm((f) => ({ ...f, crushability: parseInt(e.target.value, 10) || 0 }))}
                                                  className="w-14 rounded border border-[var(--border-amber)] bg-white px-1.5 py-1 text-sm"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-[10px] text-[var(--text-muted)]">Taste</label>
                                                <input
                                                  type="number"
                                                  min={1}
                                                  max={10}
                                                  value={editForm.taste}
                                                  onChange={(e) => setEditForm((f) => ({ ...f, taste: parseInt(e.target.value, 10) || 0 }))}
                                                  className="w-14 rounded border border-[var(--border-amber)] bg-white px-1.5 py-1 text-sm"
                                                />
                                              </div>
                                              <div className="min-w-[100px] flex-1">
                                                <label className="block text-[10px] text-[var(--text-muted)]">Guess</label>
                                                <input
                                                  type="text"
                                                  value={editForm.guess}
                                                  onChange={(e) => setEditForm((f) => ({ ...f, guess: e.target.value }))}
                                                  className="w-full rounded border border-[var(--border-amber)] bg-white px-1.5 py-1 text-sm"
                                                />
                                              </div>
                                              <div className="min-w-[120px] flex-1">
                                                <label className="block text-[10px] text-[var(--text-muted)]">Notes</label>
                                                <textarea
                                                  value={editForm.notes}
                                                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                                                  rows={2}
                                                  className="w-full rounded border border-[var(--border-amber)] bg-white px-1.5 py-1 text-sm resize-none"
                                                />
                                              </div>
                                              <div className="flex gap-1">
                                                <button
                                                  type="button"
                                                  onClick={async () => {
                                                    if (!editingRating) return;
                                                    setSavingRating(true);
                                                    const supabase = createSupabaseClient();
                                                    await supabase.from("ratings").upsert({
                                                      session_id: editingRating.session_id,
                                                      player_id: editingRating.player_id,
                                                      beer_number: editingRating.beer_number,
                                                      crushability: editForm.crushability,
                                                      taste: editForm.taste,
                                                      guess: editForm.guess.trim() || null,
                                                      notes: editForm.notes.trim() || null,
                                                    }, { onConflict: "player_id,beer_number" });
                                                    await fetchResultsData();
                                                    setEditingRating(null);
                                                    setSavingRating(false);
                                                  }}
                                                  disabled={savingRating || editForm.crushability < 1 || editForm.crushability > 10 || editForm.taste < 1 || editForm.taste > 10}
                                                  className="rounded bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] text-[var(--button-text)] font-medium px-2 py-1 text-xs disabled:opacity-50"
                                                >
                                                  💾 Save
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setEditingRating(null)}
                                                  disabled={savingRating}
                                                  className="rounded border border-[var(--border-amber)] bg-white hover:bg-amber-50 px-2 py-1 text-xs disabled:opacity-50"
                                                >
                                                  ✕ Cancel
                                                </button>
                                              </div>
                                            </div>
                                          </td>
                                        ) : (
                                          <>
                                            <td className="px-3 py-2 font-medium">{playerMap.get(r.player_id)?.name ?? "—"}</td>
                                            <td className="px-3 py-2">{r.crushability ?? "—"}</td>
                                            <td className="px-3 py-2">{r.taste ?? "—"}</td>
                                            <td className="px-3 py-2 max-w-[120px] truncate" title={r.guess ?? ""}>{r.guess ?? "—"}</td>
                                            <td className="px-3 py-2 whitespace-normal break-words">{r.notes ?? "—"}</td>
                                            <td className="px-3 py-2 w-10">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEditingRating(r);
                                                  setEditForm({
                                                    crushability: r.crushability ?? 0,
                                                    taste: r.taste ?? 0,
                                                    guess: r.guess ?? "",
                                                    notes: r.notes ?? "",
                                                  });
                                                }}
                                                className="text-sm hover:opacity-80"
                                                title="Edit rating"
                                              >
                                                ✏️
                                              </button>
                                            </td>
                                          </>
                                        )}
                                      </tr>
                                    );
                                  })
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
