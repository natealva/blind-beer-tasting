"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";
import type { Rating, BeerReveal } from "@/types/database";

export default function SessionDonePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string) ?? "";
  const [playerName, setPlayerName] = useState("");
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [reveals, setReveals] = useState<BeerReveal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const playerId = typeof window !== "undefined" ? sessionStorage.getItem("player_id") : null;
    const name = typeof window !== "undefined" ? sessionStorage.getItem("player_name") : null;
    const storedCode = typeof window !== "undefined" ? sessionStorage.getItem("player_session_code") : null;
    if (!name || !playerId || storedCode !== code) {
      router.replace(`/session/${code}`);
      return;
    }
    setPlayerName(name);

    const supabase = createSupabaseClient();
    supabase
      .from("sessions")
      .select("id")
      .eq("code", code)
      .single()
      .then(({ data: session, error }) => {
        if (error || !session) {
          setLoading(false);
          return;
        }
        Promise.all([
          supabase.from("ratings").select("*").eq("session_id", session.id).eq("player_id", playerId),
          supabase.from("beer_reveals").select("*").eq("session_id", session.id).order("beer_number"),
        ]).then(([ratRes, revRes]) => {
          setRatings(ratRes.data ?? []);
          setReveals(revRes.data ?? []);
          setLoading(false);
        });
      });
  }, [code, router]);

  const sortedRatings = useMemo(() => [...ratings].sort((a, b) => a.beer_number - b.beer_number), [ratings]);
  const revealByNumber = useMemo(() => new Map(reveals.map((r) => [r.beer_number, r])), [reveals]);

  const withScores = useMemo(
    () => sortedRatings.filter((r) => r.crushability != null && r.taste != null),
    [sortedRatings]
  );
  const avgCrush = withScores.length
    ? withScores.reduce((s, r) => s + (r.crushability ?? 0), 0) / withScores.length
    : 0;
  const avgTaste = withScores.length
    ? withScores.reduce((s, r) => s + (r.taste ?? 0), 0) / withScores.length
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--amber-dark)] text-[var(--amber-light)] flex items-center justify-center">
        <p className="text-[var(--amber-muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--amber-dark)] text-[var(--amber-light)] flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-[480px] mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-[var(--amber-light)] text-center">
          🎉 You&apos;re done, {playerName}!
        </h1>

        <div className="space-y-4">
          {sortedRatings.length === 0 ? (
            <p className="text-[var(--amber-muted)] text-center">You haven&apos;t rated any beers yet.</p>
          ) : (
            sortedRatings.map((r) => {
              const rev = revealByNumber.get(r.beer_number);
              return (
                <div
                  key={r.id}
                  className="rounded-xl bg-[var(--amber-darker)] border border-[var(--amber-border)] overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-[var(--amber-border)]">
                    <span className="font-mono font-bold text-[var(--amber-gold)]">Beer #{r.beer_number}</span>
                    {rev?.beer_name && (
                      <span className="ml-2 text-[var(--amber-light)]">{rev.beer_name}</span>
                    )}
                  </div>
                  <div className="px-4 py-3 space-y-1 text-sm">
                    <p className="text-[var(--amber-light)]">
                      Crushability: <span className="font-semibold text-[var(--amber-warm)]">{r.crushability ?? "—"}</span>/10
                    </p>
                    <p className="text-[var(--amber-light)]">
                      Taste: <span className="font-semibold text-[var(--amber-warm)]">{r.taste ?? "—"}</span>/10
                    </p>
                    {r.guess && (
                      <p className="text-[var(--amber-muted)]">
                        Your guess: <span className="text-[var(--amber-light)]">{r.guess}</span>
                      </p>
                    )}
                    {r.notes && (
                      <p className="text-[var(--amber-muted)]">
                        Notes: <span className="text-[var(--amber-light)]">{r.notes}</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {withScores.length > 0 && (
          <div className="rounded-xl bg-[var(--amber-darker)] border border-[var(--amber-gold)] px-4 py-3 text-center">
            <p className="text-[var(--amber-muted)] text-sm mb-1">Your averages</p>
            <p className="text-[var(--amber-light)]">
              Crushability: <span className="font-bold text-[var(--amber-gold)]">{avgCrush.toFixed(1)}</span>/10
              {" · "}
              Taste: <span className="font-bold text-[var(--amber-gold)]">{avgTaste.toFixed(1)}</span>/10
            </p>
          </div>
        )}

        <p className="text-[var(--amber-light)]/90 text-center">
          Now sit back and wait for the reveal! 🍺
        </p>

        <Link
          href="/"
          className="block w-full text-center rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-warm)] text-[var(--amber-darker)] font-bold py-3.5 transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
