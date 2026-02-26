"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseClient } from "@/lib/supabase";
import { getRandomBeerGif } from "@/lib/beerGifs";
import type { Rating, BeerReveal } from "@/types/database";

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

        setLoading(false);
      });
  }, [code, router]);

  const allBeerNumbers = useMemo(
    () => Array.from({ length: beerCount }, (_, i) => i + 1),
    [beerCount]
  );

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
    if ((updated?.length ?? 0) >= beerCount) setCompletionDismissed(false);
  }

  function handleBackToPicker() {
    setSelectedBeerNumber(null);
    setPhase("picker");
    setPickerSelection("");
    setCurrentGif(getRandomBeerGif());
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
