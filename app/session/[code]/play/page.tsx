"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";
import type { Rating, BeerReveal } from "@/types/database";

const START_BEER_KEY = "player_start_beer";

function getPlayerFromStorage(code: string): { playerId: string; playerName: string } | null {
  if (typeof window === "undefined") return null;
  const storedCode = sessionStorage.getItem("player_session_code");
  const playerId = sessionStorage.getItem("player_id");
  const playerName = sessionStorage.getItem("player_name");
  if (storedCode !== code || !playerId || !playerName) return null;
  return { playerId, playerName };
}

function getStoredStartBeer(code: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(`${START_BEER_KEY}_${code}`);
  if (raw == null) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function buildSequenceFromStart(start: number, beerCount: number): number[] {
  const seq: number[] = [];
  for (let i = 0; i < beerCount; i++) {
    const n = ((start - 1 + i) % beerCount) + 1;
    seq.push(n);
  }
  return seq;
}

export default function SessionPlayPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string) ?? "";
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [beerCount, setBeerCount] = useState(0);
  const [startBeer, setStartBeer] = useState<number | null>(null);
  const [beerReveals, setBeerReveals] = useState<BeerReveal[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [beerSequence, setBeerSequence] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [skippedOrder, setSkippedOrder] = useState<number[]>([]);
  const [isRound2, setIsRound2] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

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

        const storedStart = getStoredStartBeer(code);
        if (storedStart != null && storedStart >= 1 && storedStart <= session.beer_count) {
          setStartBeer(storedStart);
          setBeerSequence(buildSequenceFromStart(storedStart, session.beer_count));
        }

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

        setLoading(false);
      });
  }, [code, router]);

  // Set currentIndex to first unrated beer in sequence (after data loaded)
  useEffect(() => {
    if (beerSequence.length === 0) return;
    const ratedSet = new Set(ratings.map((r) => r.beer_number));
    const firstUnrated = beerSequence.findIndex((n) => !ratedSet.has(n));
    setCurrentIndex(firstUnrated >= 0 ? firstUnrated : beerSequence.length - 1);
  }, [beerSequence, ratings]);

  const currentBeerNumber = beerSequence[currentIndex] ?? null;
  const existingRating = currentBeerNumber
    ? ratings.find((r) => r.beer_number === currentBeerNumber) ?? null
    : null;

  const allRated = beerSequence.length > 0 && beerSequence.every((n) => ratings.some((r) => r.beer_number === n));

  useEffect(() => {
    if (!loading && sessionId && allRated && skippedOrder.length === 0) {
      router.replace(`/session/${code}/done`);
    }
  }, [loading, sessionId, allRated, skippedOrder.length, code, router]);

  function handleStartRating(selectedStart: number) {
    if (selectedStart < 1 || selectedStart > beerCount) return;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`${START_BEER_KEY}_${code}`, String(selectedStart));
    }
    setStartBeer(selectedStart);
    setBeerSequence(buildSequenceFromStart(selectedStart, beerCount));
  }

  async function handleSave(payload: {
    crushability: number;
    taste: number;
    guess: string | null;
    notes: string | null;
  }) {
    if (!sessionId || !playerId || currentBeerNumber == null) return;
    setInlineError(null);
    setSaving(true);
    const supabase = createSupabaseClient();
    await supabase.from("ratings").upsert(
      {
        session_id: sessionId,
        player_id: playerId,
        beer_number: currentBeerNumber,
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
    advanceToNext();
  }

  function advanceToNext(updatedSkipped?: number[]) {
    const skipped = updatedSkipped ?? skippedOrder;
    if (currentIndex >= beerSequence.length - 1) {
      if (!isRound2 && skipped.length > 0) {
        setBeerSequence([...skipped]);
        setSkippedOrder([]);
        setIsRound2(true);
        setCurrentIndex(0);
      } else {
        router.push(`/session/${code}/done`);
      }
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  function handleSkip() {
    if (currentBeerNumber == null) return;
    if (isRound2) {
      advanceToNext();
      return;
    }
    const nextSkipped = skippedOrder.includes(currentBeerNumber)
      ? skippedOrder
      : [...skippedOrder, currentBeerNumber];
    setSkippedOrder(nextSkipped);
    advanceToNext(nextSkipped);
  }

  const [startScreenSelection, setStartScreenSelection] = useState<number | "">("");
  const showStartScreen = sessionId != null && beerCount > 0 && startBeer == null && beerSequence.length === 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--amber-dark)] text-[var(--amber-light)] flex items-center justify-center">
        <p className="text-[var(--amber-muted)]">Loading…</p>
      </div>
    );
  }

  if (!sessionId || beerCount === 0) {
    return (
      <div className="min-h-screen bg-[var(--amber-dark)] text-[var(--amber-light)] flex items-center justify-center">
        <p className="text-amber-400">Session not found.</p>
      </div>
    );
  }

  if (showStartScreen) {
    return (
      <div className="min-h-screen bg-[var(--amber-dark)] text-[var(--amber-light)] flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-[480px] mx-auto space-y-6">
          <Link href="/" className="text-[var(--amber-muted)] hover:text-[var(--amber-warm)] text-sm inline-block mb-4">
            Home
          </Link>
          <h1 className="text-2xl font-bold text-[var(--amber-light)]">Which beer are you starting with?</h1>
          <select
            value={startScreenSelection === "" ? "" : startScreenSelection}
            onChange={(e) => {
              const v = e.target.value;
              setStartScreenSelection(v === "" ? "" : parseInt(v, 10));
            }}
            className="w-full rounded-lg bg-[var(--amber-darker)] border-2 border-[var(--amber-border)] text-[var(--amber-light)] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)]"
          >
            <option value="">Select a beer number</option>
            {Array.from({ length: beerCount }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>Beer #{n}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const n = startScreenSelection === "" ? null : startScreenSelection;
              if (typeof n === "number" && Number.isFinite(n)) handleStartRating(n);
            }}
            disabled={startScreenSelection === ""}
            className="w-full rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-warm)] disabled:opacity-50 text-[var(--amber-darker)] font-bold py-3.5 transition-colors"
          >
            Start Rating →
          </button>
        </div>
      </div>
    );
  }

  if (beerSequence.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--amber-dark)] text-[var(--amber-light)] flex items-center justify-center">
        <p className="text-[var(--amber-muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--amber-dark)] text-[var(--amber-light)] flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-[480px] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[var(--amber-muted)] text-sm">
            Beer {currentIndex + 1} of {beerSequence.length}
          </span>
          <Link href="/" className="text-[var(--amber-muted)] hover:text-[var(--amber-warm)] text-sm">
            Home
          </Link>
        </div>
        <div className="h-2 bg-[var(--amber-darker)] rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-[var(--amber-gold)] rounded-full transition-all duration-300"
            style={{ width: `${(100 * (currentIndex + 1)) / beerSequence.length}%` }}
          />
        </div>

        <BeerRatingForm
          key={currentBeerNumber}
          beerNumber={currentBeerNumber!}
          existing={existingRating}
          beerReveals={beerReveals}
          onSave={handleSave}
          onSkip={handleSkip}
          saving={saving}
          inlineError={inlineError}
          setInlineError={setInlineError}
          isLast={currentIndex >= beerSequence.length - 1 && (isRound2 || skippedOrder.length === 0)}
        />
      </div>
    </div>
  );
}

function BeerRatingForm({
  beerNumber,
  existing,
  beerReveals,
  onSave,
  onSkip,
  saving,
  inlineError,
  setInlineError,
  isLast,
}: {
  beerNumber: number;
  existing: Rating | null;
  beerReveals: BeerReveal[];
  onSave: (payload: { crushability: number; taste: number; guess: string | null; notes: string | null }) => void;
  onSkip: () => void;
  saving: boolean;
  inlineError: string | null;
  setInlineError: (s: string | null) => void;
  isLast: boolean;
}) {
  const [crushability, setCrushability] = useState<number | null>(existing?.crushability ?? null);
  const [taste, setTaste] = useState<number | null>(existing?.taste ?? null);
  const [guess, setGuess] = useState(existing?.guess ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const hasReveals = beerReveals.length > 0;
  const guessOptions = useMemo(() => Array.from(new Set(beerReveals.map((r) => r.beer_name).filter(Boolean))), [beerReveals]);

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
      <h1 className="text-3xl font-bold text-[var(--amber-light)]">Beer #{beerNumber}</h1>

      <div>
        <p className="text-[var(--amber-muted)] text-sm font-medium mb-2">Crushability 🍺</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCrushability(n)}
              className={`w-10 h-10 rounded-lg font-semibold transition-colors ${
                crushability === n
                  ? "bg-[var(--amber-gold)] text-[var(--amber-darker)]"
                  : "bg-[var(--amber-darker)] border-2 border-[var(--amber-border)] text-[var(--amber-light)] hover:border-[var(--amber-gold)]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[var(--amber-muted)] text-sm font-medium mb-2">Taste 👅</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setTaste(n)}
              className={`w-10 h-10 rounded-lg font-semibold transition-colors ${
                taste === n
                  ? "bg-[var(--amber-gold)] text-[var(--amber-darker)]"
                  : "bg-[var(--amber-darker)] border-2 border-[var(--amber-border)] text-[var(--amber-light)] hover:border-[var(--amber-gold)]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[var(--amber-muted)] text-sm font-medium mb-1">Your guess</label>
        {hasReveals ? (
          <select
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            className="w-full rounded-lg bg-[var(--amber-darker)] border-2 border-[var(--amber-border)] text-[var(--amber-light)] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)]"
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
            className="w-full rounded-lg bg-[var(--amber-darker)] border-2 border-[var(--amber-border)] text-[var(--amber-light)] px-3 py-2.5 placeholder-amber-600 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)]"
          />
        )}
      </div>

      <div>
        <label className="block text-[var(--amber-muted)] text-sm font-medium mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any tasting notes..."
          rows={3}
          className="w-full rounded-lg bg-[var(--amber-darker)] border-2 border-[var(--amber-border)] text-[var(--amber-light)] px-3 py-2.5 placeholder-amber-600 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)] resize-none"
        />
      </div>

      {inlineError && (
        <p className="text-amber-400 text-sm" role="alert">
          {inlineError}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-warm)] disabled:opacity-50 text-[var(--amber-darker)] font-bold py-3.5 transition-colors"
      >
        {saving ? "Saving…" : isLast ? "Save & Finish →" : "Save & Next Beer →"}
      </button>
      <button
        type="button"
        onClick={onSkip}
        className="w-full rounded-xl border-2 border-[var(--amber-border)] text-[var(--amber-muted)] hover:bg-[var(--amber-darker)] font-medium py-2.5 transition-colors mt-2"
      >
        Skip for now →
      </button>
    </form>
  );
}
