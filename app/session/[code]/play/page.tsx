"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseClient } from "@/lib/supabase";
import { getRandomBeerGif } from "@/lib/beerGifs";
import { getCriteria, getCriterionScore } from "@/lib/criteriaUtils";
import { getItemLabel, isBeer } from "@/lib/tastingUtils";
import type { Rating, BeerReveal, Session } from "@/types/database";

const CHART_HEIGHT = 200;
const BAR_WIDTH = 44;

function pxFromScore(score: number): number {
  return Math.max(0, (score / 10) * CHART_HEIGHT);
}

function GroupBarChart({
  rows,
  getGroupValue,
  getPlayerScore,
  title,
}: {
  rows: { beerNumber: number; groupAvg: number }[];
  getGroupValue: (r: { groupAvg: number }) => number;
  getPlayerScore: (beerNumber: number) => number | null;
  title: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-amber)] p-4">
      <h3 className="text-sm font-bold text-[var(--text-heading)] mb-2">{title}</h3>
      <p className="text-[10px] text-[var(--text-muted)] mb-2">▬ Group average</p>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "4px" }}>
        <div style={{ position: "relative", height: "200px", width: "28px", flexShrink: 0 }}>
          {[10, 8, 6, 4, 2, 0].map((val, i) => (
            <span
              key={val}
              style={{
                position: "absolute",
                top: `${i * 40}px`,
                right: "2px",
                transform: "translateY(-50%)",
                fontSize: "11px",
                color: "#92400e",
              }}
            >
              {val}
            </span>
          ))}
        </div>
        <div style={{ overflowX: "auto", borderLeft: "1px solid #d97706", borderBottom: "1px solid #d97706", flexGrow: 1 }}>
          <div style={{ display: "inline-flex", flexDirection: "column", minWidth: "100%" }}>
            <div style={{ position: "relative", height: "200px", display: "flex", alignItems: "flex-end", gap: "12px", padding: "0 8px" }}>
              {[0, 40, 80, 120, 160].map((topPx) => (
                <div key={topPx} style={{ position: "absolute", top: `${topPx}px`, left: 0, right: 0, height: "1px", background: "rgba(217,119,6,0.15)", pointerEvents: "none" }} />
              ))}
              {rows.map((row) => {
                const groupAvg = getGroupValue(row);
                const playerScore = getPlayerScore(row.beerNumber);
                const hasPlayerRating = playerScore != null && playerScore >= 0 && playerScore <= 10;
                const barValue = hasPlayerRating ? playerScore! : groupAvg;
                const barHeightPx = pxFromScore(barValue);
                const groupLineBottomPx = groupAvg >= 0 && groupAvg <= 10 ? pxFromScore(groupAvg) : null;
                const barColor = hasPlayerRating ? "#d97706" : "#fbbf24";
                return (
                  <div key={row.beerNumber} style={{ position: "relative", height: "200px", width: `${BAR_WIDTH}px`, flexShrink: 0 }}>
                    {hasPlayerRating && groupLineBottomPx != null && groupLineBottomPx > 0 && (
                      <div style={{ position: "absolute", bottom: `${groupLineBottomPx}px`, left: 0, right: 0, height: "2px", background: "#7f1d1d", zIndex: 2, pointerEvents: "none" }} title={`Group avg: ${groupAvg.toFixed(1)}`} />
                    )}
                    <div style={{ position: "absolute", bottom: 0, left: 0, height: `${barHeightPx}px`, width: `${BAR_WIDTH}px`, background: barColor, borderRadius: "4px 4px 0 0", minHeight: barHeightPx > 0 ? 2 : 0 }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "12px", padding: "4px 8px 0" }}>
              {rows.map((row) => (
                <div
                  key={row.beerNumber}
                  style={{ width: "44px", fontSize: "10px", textAlign: "center", color: "#92400e", flexShrink: 0, wordBreak: "break-word", lineHeight: "1.2" }}
                >
                  #{row.beerNumber}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getPlayerFromStorage(code: string): { playerId: string; playerName: string } | null {
  if (typeof window === "undefined") return null;
  const storedCode = sessionStorage.getItem("player_session_code");
  const playerId = sessionStorage.getItem("player_id");
  const playerName = sessionStorage.getItem("player_name");
  if (storedCode !== code || !playerId || !playerName) return null;
  return { playerId, playerName };
}

export default function SessionPlayPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string) ?? "";
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [beerCount, setBeerCount] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [criteria, setCriteria] = useState(getCriteria(null));
  const [beerReveals, setBeerReveals] = useState<BeerReveal[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"picker" | "rating">("picker");
  const [selectedBeerNumber, setSelectedBeerNumber] = useState<number | null>(null);
  const [pickerSelection, setPickerSelection] = useState<number | "">("");
  const [completionDismissed, setCompletionDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [currentGif, setCurrentGif] = useState<string>(getRandomBeerGif());
  const [allSessionRatings, setAllSessionRatings] = useState<Rating[]>([]);
  const [isLocked, setIsLocked] = useState(false);

  const fetchAllSessionRatings = useCallback(async () => {
    if (!sessionId) return;
    const supabase = createSupabaseClient();
    const { data } = await supabase.from("ratings").select("*").eq("session_id", sessionId);
    setAllSessionRatings(data ?? []);
  }, [sessionId]);

  useEffect(() => {
    const player = getPlayerFromStorage(code);
    if (!player) {
      router.replace(`/session/${code}`);
      return;
    }
    setPlayerId(player.playerId);

    const supabase = createSupabaseClient();
    supabase
      .from("sessions")
      .select("*")
      .eq("code", code)
      .single()
      .then(({ data: session, error: se }) => {
        if (se || !session) {
          setLoading(false);
          return;
        }
        setSession(session as Session);
        setSessionId(session.id);
        setBeerCount(session.beer_count);
        setCriteria(getCriteria(session));

        supabase
          .from("beer_reveals")
          .select("*")
          .eq("session_id", session.id)
          .order("beer_number")
          .then(({ data }) => setBeerReveals(data ?? []));

        supabase
          .from("ratings")
          .select("*")
          .eq("session_id", session.id)
          .eq("player_id", player.playerId)
          .then(({ data }) => {
            const list = data ?? [];
            setRatings(list);
            const anyLocked = list.some((r: Rating) => r.locked === true);
            setIsLocked(anyLocked);
            setLoading(false);
          });

        supabase
          .from("ratings")
          .select("*")
          .eq("session_id", session.id)
          .then(({ data }) => setAllSessionRatings(data ?? []));
      });
  }, [code, router]);

  const allBeerNumbers = useMemo(
    () => Array.from({ length: beerCount }, (_, i) => i + 1),
    [beerCount]
  );

  const playerRatedBeerNumbers = useMemo(
    () => new Set(ratings.map((r) => r.beer_number)),
    [ratings]
  );

  // criteria is stable for a given session; we intentionally omit it from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groupChartData = useMemo(() => {
    return criteria.map((c) => {
      const byBeer = new Map<number, number[]>();
      for (const r of allSessionRatings) {
        const s = getCriterionScore(r, c.id);
        if (s != null) {
          const arr = byBeer.get(r.beer_number) ?? [];
          arr.push(s);
          byBeer.set(r.beer_number, arr);
        }
      }
      const avg = (arr: number[]) => (arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0);
      const rows = Array.from(byBeer.entries())
        .filter(([beerNumber]) => playerRatedBeerNumbers.has(beerNumber))
        .map(([beerNumber, vals]) => ({ beerNumber, groupAvg: avg(vals) }))
        .sort((a, b) => a.beerNumber - b.beerNumber);
      const getPlayerScore = (beerNumber: number) => {
        const r = ratings.find((x) => x.beer_number === beerNumber);
        return getCriterionScore(r ?? null, c.id);
      };
      return { criterion: c, rows, getPlayerScore };
    });
  }, [allSessionRatings, ratings, playerRatedBeerNumbers]);

  const hasAnyGroupRatings = allSessionRatings.length > 0;
  const showPickerCharts = ratings.length > 0;

  const allComplete = beerCount > 0 && ratings.length >= beerCount;
  const showCompletionScreen = phase === "picker" && allComplete && !completionDismissed;

  const existingRating = selectedBeerNumber != null
    ? ratings.find((r) => r.beer_number === selectedBeerNumber) ?? null
    : null;

  function handleStartRating() {
    const n = pickerSelection === "" ? null : pickerSelection;
    if (typeof n === "number" && n >= 1 && n <= beerCount) {
      setCompletionDismissed(false);
      setSelectedBeerNumber(n);
      setPickerSelection("");
      setPhase("rating");
    }
  }

  async function handleSave(payload: {
    criteriaScores: Record<string, number>;
    guess: string | null;
    notes: string | null;
  }) {
    if (!sessionId || !playerId || selectedBeerNumber == null) return;
    const { criteriaScores, guess, notes } = payload;
    // eslint-disable-next-line no-console
    console.log("[play] criteria loaded for session:", criteria);
    const allFilled = criteria.every((c) => criteriaScores[c.id] != null);
    if (!allFilled) {
      setInlineError("Please rate all criteria before saving.");
      return;
    }
    setInlineError(null);
    setSaving(true);
    const supabase = createSupabaseClient();
    const row = {
      session_id: sessionId,
      player_id: playerId,
      beer_number: selectedBeerNumber,
      criteria_scores: criteriaScores,
      taste: criteriaScores["taste"] ?? null,
      crushability: criteriaScores["crushability"] ?? null,
      guess: guess || null,
      notes: notes || null,
    };
    // eslint-disable-next-line no-console
    console.log("Saving rating with data:", {
      session_id: sessionId,
      player_id: playerId,
      beer_number: selectedBeerNumber,
      criteria_scores: criteriaScores,
      taste: criteriaScores["taste"] ?? null,
      crushability: criteriaScores["crushability"] ?? null,
    });
    const { data: savedData, error: saveError } = await supabase
      .from("ratings")
      .upsert(row, { onConflict: "player_id,beer_number" })
      .select();
    // eslint-disable-next-line no-console
    console.log("Save result:", savedData, "Error:", saveError);
    const { data: updated } = await supabase
      .from("ratings")
      .select("*")
      .eq("session_id", sessionId)
      .eq("player_id", playerId);
    setRatings(updated ?? []);
    setSaving(false);
    setSelectedBeerNumber(null);
    setPhase("picker");
    setCurrentGif(getRandomBeerGif());
    fetchAllSessionRatings();
    if ((updated?.length ?? 0) >= beerCount) setCompletionDismissed(false);
  }

  function handleBackToPicker() {
    setSelectedBeerNumber(null);
    setPhase("picker");
    setPickerSelection("");
    setCurrentGif(getRandomBeerGif());
    fetchAllSessionRatings();
  }

  const itemLabel = session ? getItemLabel(session) : "Beer";

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  if (!sessionId || beerCount === 0) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex items-center justify-center">
        <p className="text-amber-600">Session not found.</p>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex flex-col items-center justify-center" style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: "48px" }}>🔒</div>
        <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#451a03", margin: "16px 0 8px" }}>
          Your answers are locked
        </h2>
        <p style={{ color: "#92400e", marginBottom: "24px" }}>
          You&apos;ve already completed the reveal. Your scores can&apos;t be changed.
        </p>
        <Link
          href={`/session/${code}/reveal`}
          className="block w-full max-w-[320px] mx-auto rounded-xl font-bold py-3.5 text-center transition-colors"
          style={{ background: "#f59e0b", color: "#451a03", padding: "14px 24px", borderRadius: "12px", fontWeight: 700, textDecoration: "none" }}
        >
          View My Results →
        </Link>
      </div>
    );
  }

  if (phase === "rating" && selectedBeerNumber != null) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex flex-col items-center px-4 py-6">
        <div className="w-full max-w-[480px] mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              type="button"
              onClick={handleBackToPicker}
              className="text-[var(--text-muted)] hover:text-[var(--amber-gold)] text-sm"
            >
              ← Back to picker
            </button>
            <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--amber-gold)] text-sm">
              Home
            </Link>
          </div>
          <BeerRatingForm
            key={selectedBeerNumber}
            beerNumber={selectedBeerNumber}
            itemLabel={itemLabel}
            criteria={criteria}
            existing={existingRating}
            beerReveals={beerReveals}
            onSave={handleSave}
            saving={saving}
            inlineError={inlineError}
            setInlineError={setInlineError}
          />
        </div>
      </div>
    );
  }

  if (showCompletionScreen) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-[480px] mx-auto space-y-6 text-center">
          <h1 className="text-3xl font-bold text-[var(--text-heading)]">
            🎉 You&apos;ve tasted all {beerCount} beers!
          </h1>
          <p className="text-[var(--text-muted)]">
            Nice work. You can keep rating to update scores or head to your summary.
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setCurrentGif(getRandomBeerGif());
                setCompletionDismissed(true);
                fetchAllSessionRatings();
              }}
              className="w-full rounded-xl bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] font-bold py-3.5 transition-colors hover:bg-amber-50"
            >
              Keep Rating →
            </button>
            <Link
              href={`/session/${code}/done`}
              className="block w-full rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] text-[var(--button-text)] font-bold py-3.5 text-center transition-colors"
            >
              View My Summary →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-[480px] mx-auto space-y-6">
        <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--amber-gold)] text-sm inline-block mb-4">
          Home
        </Link>
        {session && isBeer(session) && (
          <Image
            src={currentGif}
            alt="Beer cheers"
            width={120}
            height={120}
            unoptimized
            className="mx-auto mb-4 rounded-lg"
          />
        )}
        <h1 className="text-2xl font-bold text-[var(--text-heading)]">
          Which {itemLabel} are you tasting?
        </h1>
        <select
          value={pickerSelection === "" ? "" : pickerSelection}
          onChange={(e) => {
            const v = e.target.value;
            setPickerSelection(v === "" ? "" : parseInt(v, 10));
          }}
          className="w-full rounded-lg bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)]"
        >
          <option value="">Select a {itemLabel.toLowerCase()} number</option>
          {allBeerNumbers.map((n) => (
          <option key={n} value={n}>
            {itemLabel} #{n}
          </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleStartRating}
          disabled={pickerSelection === ""}
          className="w-full rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] disabled:opacity-50 text-[var(--button-text)] font-bold py-3.5 transition-colors"
        >
          Rate This {itemLabel} →
        </button>
        {ratings.length > 0 && (
          <p className="text-[var(--text-muted)] text-sm text-center">
            You&apos;ve submitted {ratings.length} rating{ratings.length !== 1 ? "s" : ""}. You can rate any beer again to update.
          </p>
        )}
        <p className="text-center">
          <Link href={`/session/${code}/done`} className="text-[var(--amber-gold)] hover:underline text-sm">
            View my summary →
          </Link>
        </p>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--text-heading)]">📊 Group Scores So Far</h2>
          {!showPickerCharts ? (
            <p className="text-[var(--text-muted)] text-sm text-center py-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-amber)]">
              Your scores will appear here after you rate your first {itemLabel.toLowerCase()}.
            </p>
          ) : hasAnyGroupRatings ? (
            <>
              {groupChartData.map(({ criterion, rows, getPlayerScore }) => (
                <GroupBarChart
                  key={criterion.id}
                  rows={rows}
                  getGroupValue={(r) => r.groupAvg}
                  getPlayerScore={getPlayerScore}
                  title={`Group ${criterion.label} Scores So Far`}
                />
              ))}
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function BeerRatingForm({
  beerNumber,
  itemLabel,
  criteria,
  existing,
  beerReveals,
  onSave,
  saving,
  inlineError,
  setInlineError,
}: {
  beerNumber: number;
  itemLabel: string;
  criteria: { id: string; label: string; emoji: string }[];
  existing: Rating | null;
  beerReveals: BeerReveal[];
  onSave: (payload: { criteriaScores: Record<string, number>; guess: string | null; notes: string | null }) => void;
  saving: boolean;
  inlineError: string | null;
  setInlineError: (s: string | null) => void;
}) {
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number | null>>({});
  const [guess, setGuess] = useState(existing?.guess ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");

  useEffect(() => {
    const initial: Record<string, number | null> = {};
    for (const c of criteria) {
      initial[c.id] = getCriterionScore(existing ?? null, c.id);
    }
    setCriteriaScores(initial);
  }, [criteria, existing]);

  const hasReveals = beerReveals.length > 0;
  const guessOptions = useMemo(
    () =>
      Array.from(new Set(beerReveals.map((r) => r.beer_name).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      ),
    [beerReveals]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInlineError(null);
    const missing = criteria.filter((c) => criteriaScores[c.id] == null);
    if (missing.length > 0) {
      setInlineError(`Please select a score (1–10) for every criterion: ${missing.map((c) => c.label).join(", ")}.`);
      return;
    }
    const outOfRange = criteria.some((c) => {
      const s = criteriaScores[c.id];
      return s != null && (s < 1 || s > 10);
    });
    if (outOfRange) {
      setInlineError("All scores must be between 1 and 10.");
      return;
    }
    const scores = criteria.reduce((acc, c) => {
      const s = criteriaScores[c.id];
      if (s != null) acc[c.id] = s;
      return acc;
    }, {} as Record<string, number>);
    onSave({
      criteriaScores: scores,
      guess: guess.trim() || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--text-heading)]">
        {itemLabel} #{beerNumber}
      </h1>

      {criteria.map((criterion) => (
        <div key={criterion.id}>
          <div className="text-[var(--text-muted)] text-sm font-medium mb-2">{criterion.emoji} {criterion.label}</div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCriteriaScores((prev) => ({ ...prev, [criterion.id]: n }))}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "8px",
                  border: "2px solid #d97706",
                  background: criteriaScores[criterion.id] === n ? "#f59e0b" : "white",
                  fontWeight: criteriaScores[criterion.id] === n ? 700 : 400,
                  color: "#451a03",
                  cursor: "pointer",
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div>
        <label className="block text-[var(--text-muted)] text-sm font-medium mb-1">Your guess</label>
        {hasReveals ? (
          <select
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            className="w-full rounded-lg bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)]"
          >
            <option value="">-- Take a guess --</option>
            {guessOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="e.g. IPA from Local Brewery"
            className="w-full rounded-lg bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-3 py-2.5 placeholder-amber-500 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)]"
          />
        )}
      </div>

      <div>
        <label className="block text-[var(--text-muted)] text-sm font-medium mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any tasting notes..."
          rows={3}
          className="w-full rounded-lg bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-3 py-2.5 placeholder-amber-500 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)] resize-none"
        />
      </div>

      {inlineError && (
        <p className="text-amber-600 text-sm" role="alert">
          {inlineError}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] disabled:opacity-50 text-[var(--button-text)] font-bold py-3.5 transition-colors"
      >
        {saving ? "Saving…" : "Save & back to picker"}
      </button>
    </form>
  );
}
