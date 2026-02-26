"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseClient } from "@/lib/supabase";
import { getRandomBeerGif } from "@/lib/beerGifs";
import type { Rating, BeerReveal } from "@/types/database";

const CHART_HEIGHT_PX = 200;
const BAR_WIDTH_PX = 32;
const Y_AXIS_VALUES = [10, 8, 6, 4, 2, 0];

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
      <div className="flex items-end overflow-x-auto pb-2" style={{ gap: 8 }}>
        <div style={{ position: "relative", height: CHART_HEIGHT_PX, marginRight: 8, width: 24 }}>
          {Y_AXIS_VALUES.map((val, i) => (
            <span
              key={val}
              style={{
                position: "absolute",
                top: `${i * 40}px`,
                right: 0,
                fontSize: "11px",
                color: "#92400e",
                transform: "translateY(-50%)",
                lineHeight: 1,
              }}
            >
              {val}
            </span>
          ))}
        </div>
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div
            className="relative flex items-end border-l border-b border-amber-600"
            style={{ height: CHART_HEIGHT_PX, gap: 8 }}
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: `${i * 40}px`,
                  left: 0,
                  right: 0,
                  height: "1px",
                  background: "rgba(217,119,6,0.2)",
                }}
              />
            ))}
            {rows.map((row) => {
              const groupAvg = getGroupValue(row);
              const playerScore = getPlayerScore(row.beerNumber);
              const hasPlayerRating = playerScore != null && playerScore >= 0 && playerScore <= 10;
              const barValue = hasPlayerRating ? playerScore! : groupAvg;
              const barPct = Math.max(0, (barValue / 10) * 100);
              const groupLinePct = groupAvg >= 0 && groupAvg <= 10 ? (groupAvg / 10) * 100 : null;
              const barColor = hasPlayerRating ? "bg-amber-500" : "bg-amber-300";
              return (
                <div
                  key={row.beerNumber}
                  className="shrink-0 flex flex-col justify-end relative"
                  style={{ width: BAR_WIDTH_PX, height: CHART_HEIGHT_PX }}
                >
                  <div
                    className={`w-full rounded-t ${barColor} relative`}
                    style={{ height: `${barPct}%`, minHeight: barPct > 0 ? 4 : 0 }}
                  >
                    {hasPlayerRating && groupLinePct != null && groupLinePct > 0 && (
                      <div
                        className="absolute left-0 right-0 h-0.5 bg-red-800 z-20 pointer-events-none"
                        style={{ bottom: `${groupLinePct}%` }}
                        title={`Group avg: ${groupAvg.toFixed(1)}`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-1 flex-nowrap">
            {rows.map((row) => (
              <div
                key={row.beerNumber}
                className="shrink-0 text-[10px] text-[var(--text-muted)] text-center"
                style={{ width: BAR_WIDTH_PX }}
              >
                Beer #{row.beerNumber}
              </div>
            ))}
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
      .select("id, beer_count")
      .eq("code", code)
      .single()
      .then(({ data: session, error: se }) => {
        if (se || !session) {
          setLoading(false);
          return;
        }
        setSessionId(session.id);
        setBeerCount(session.beer_count);

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
          .then(({ data }) => setRatings(data ?? []));

        supabase
          .from("ratings")
          .select("*")
          .eq("session_id", session.id)
          .then(({ data }) => setAllSessionRatings(data ?? []));

        setLoading(false);
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

  const groupChartData = useMemo(() => {
    const tasteByBeer = new Map<number, number[]>();
    const crushByBeer = new Map<number, number[]>();
    for (const r of allSessionRatings) {
      if (r.taste != null) {
        const arr = tasteByBeer.get(r.beer_number) ?? [];
        arr.push(r.taste);
        tasteByBeer.set(r.beer_number, arr);
      }
      if (r.crushability != null) {
        const arr = crushByBeer.get(r.beer_number) ?? [];
        arr.push(r.crushability);
        crushByBeer.set(r.beer_number, arr);
      }
    }
    const avg = (arr: number[]) => (arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0);
    const tasteRows = Array.from(tasteByBeer.entries())
      .filter(([beerNumber]) => playerRatedBeerNumbers.has(beerNumber))
      .map(([beerNumber, vals]) => ({ beerNumber, groupAvg: avg(vals) }))
      .sort((a, b) => a.beerNumber - b.beerNumber);
    const crushRows = Array.from(crushByBeer.entries())
      .filter(([beerNumber]) => playerRatedBeerNumbers.has(beerNumber))
      .map(([beerNumber, vals]) => ({ beerNumber, groupAvg: avg(vals) }))
      .sort((a, b) => a.beerNumber - b.beerNumber);
    const getPlayerTaste = (beerNumber: number) => {
      const r = ratings.find((x) => x.beer_number === beerNumber);
      return r?.taste ?? null;
    };
    const getPlayerCrush = (beerNumber: number) => {
      const r = ratings.find((x) => x.beer_number === beerNumber);
      return r?.crushability ?? null;
    };
    return { tasteRows, crushRows, getPlayerTaste, getPlayerCrush };
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
    crushability: number;
    taste: number;
    guess: string | null;
    notes: string | null;
  }) {
    if (!sessionId || !playerId || selectedBeerNumber == null) return;
    setInlineError(null);
    setSaving(true);
    const supabase = createSupabaseClient();
    await supabase.from("ratings").upsert(
      {
        session_id: sessionId,
        player_id: playerId,
        beer_number: selectedBeerNumber,
        crushability: payload.crushability,
        taste: payload.taste,
        guess: payload.guess || null,
        notes: payload.notes || null,
      },
      { onConflict: "player_id,beer_number" }
    );
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
        <Image
          src={currentGif}
          alt="Beer cheers"
          width={120}
          height={120}
          unoptimized
          className="mx-auto mb-4 rounded-lg"
        />
        <h1 className="text-2xl font-bold text-[var(--text-heading)]">Which beer are you tasting?</h1>
        <select
          value={pickerSelection === "" ? "" : pickerSelection}
          onChange={(e) => {
            const v = e.target.value;
            setPickerSelection(v === "" ? "" : parseInt(v, 10));
          }}
          className="w-full rounded-lg bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)]"
        >
          <option value="">Select a beer number</option>
          {allBeerNumbers.map((n) => (
            <option key={n} value={n}>Beer #{n}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleStartRating}
          disabled={pickerSelection === ""}
          className="w-full rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] disabled:opacity-50 text-[var(--button-text)] font-bold py-3.5 transition-colors"
        >
          Rate This Beer →
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
              Your scores will appear here after you rate your first beer.
            </p>
          ) : hasAnyGroupRatings ? (
            <>
              <GroupBarChart
                rows={groupChartData.tasteRows}
                getGroupValue={(r) => r.groupAvg}
                getPlayerScore={groupChartData.getPlayerTaste}
                title="Group Taste Scores So Far"
              />
              <GroupBarChart
                rows={groupChartData.crushRows}
                getGroupValue={(r) => r.groupAvg}
                getPlayerScore={groupChartData.getPlayerCrush}
                title="Group Crushability Scores So Far"
              />
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function BeerRatingForm({
  beerNumber,
  existing,
  beerReveals,
  onSave,
  saving,
  inlineError,
  setInlineError,
}: {
  beerNumber: number;
  existing: Rating | null;
  beerReveals: BeerReveal[];
  onSave: (payload: { crushability: number; taste: number; guess: string | null; notes: string | null }) => void;
  saving: boolean;
  inlineError: string | null;
  setInlineError: (s: string | null) => void;
}) {
  const [crushability, setCrushability] = useState<number | null>(existing?.crushability ?? null);
  const [taste, setTaste] = useState<number | null>(existing?.taste ?? null);
  const [guess, setGuess] = useState(existing?.guess ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");

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
    if (crushability == null || taste == null) {
      setInlineError("Please select both Crushability and Taste (1–10) before saving.");
      return;
    }
    if (crushability < 1 || crushability > 10 || taste < 1 || taste > 10) {
      setInlineError("Crushability and Taste must be between 1 and 10.");
      return;
    }
    onSave({
      crushability,
      taste,
      guess: guess.trim() || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--text-heading)]">Beer #{beerNumber}</h1>

      <div>
        <p className="text-[var(--text-muted)] text-sm font-medium mb-2">Crushability 🍺</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCrushability(n)}
              className={`w-10 h-10 rounded-lg font-semibold transition-colors ${
                crushability === n
                  ? "bg-[var(--amber-gold)] text-[var(--button-text)]"
                  : "bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] hover:border-[var(--amber-gold)]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[var(--text-muted)] text-sm font-medium mb-2">Taste 👅</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setTaste(n)}
              className={`w-10 h-10 rounded-lg font-semibold transition-colors ${
                taste === n
                  ? "bg-[var(--amber-gold)] text-[var(--button-text)]"
                  : "bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] hover:border-[var(--amber-gold)]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

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
