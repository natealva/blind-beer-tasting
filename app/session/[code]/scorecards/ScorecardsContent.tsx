"use client";

import { useMemo } from "react";
import type { BeerReveal, Player, Rating } from "@/types/database";

export type ScorecardsContentProps = {
  sessionName: string;
  reveals: BeerReveal[];
  players: Player[];
  ratings: Rating[];
};

function getBeerName(beerNumber: number, revealByNumber: Map<number, BeerReveal>): string {
  return revealByNumber.get(beerNumber)?.beer_name ?? `Beer #${beerNumber}`;
}

export function ScorecardsContent({ sessionName, reveals, players, ratings }: ScorecardsContentProps) {
  const revealByNumber = useMemo(() => new Map(reveals.map((r) => [r.beer_number, r])), [reveals]);

  const playerScorecards = useMemo(() => {
    return players.map((player) => {
      const playerRatings = ratings.filter((r) => r.player_id === player.id);
      const withScores = playerRatings.filter((r) => r.taste != null && r.crushability != null);

      const overallRanked = [...withScores]
        .map((r) => ({
          beerNumber: r.beer_number,
          name: getBeerName(r.beer_number, revealByNumber),
          combined: ((r.taste ?? 0) + (r.crushability ?? 0)) / 2,
        }))
        .sort((a, b) => b.combined - a.combined);

      const tasteRanked = [...withScores]
        .map((r) => ({
          beerNumber: r.beer_number,
          name: getBeerName(r.beer_number, revealByNumber),
          score: r.taste ?? 0,
        }))
        .sort((a, b) => b.score - a.score);

      const crushRanked = [...withScores]
        .map((r) => ({
          beerNumber: r.beer_number,
          name: getBeerName(r.beer_number, revealByNumber),
          score: r.crushability ?? 0,
        }))
        .sort((a, b) => b.score - a.score);

      const guessAccuracy = playerRatings
        .sort((a, b) => a.beer_number - b.beer_number)
        .map((r) => {
          const beerName = revealByNumber.get(r.beer_number)?.beer_name ?? `Beer #${r.beer_number}`;
          const guess = r.guess?.trim() ?? "";
          const actual = revealByNumber.get(r.beer_number)?.beer_name?.trim().toLowerCase() ?? "";
          let result: "✅" | "❌" | "—" = "—";
          if (guess) result = actual && guess.toLowerCase() === actual ? "✅" : "❌";
          return { beerName, guess, result };
        });

      const avgTaste =
        withScores.length > 0
          ? withScores.reduce((s, r) => s + (r.taste ?? 0), 0) / withScores.length
          : 0;
      const avgCrush =
        withScores.length > 0
          ? withScores.reduce((s, r) => s + (r.crushability ?? 0), 0) / withScores.length
          : 0;
      const withGuess = playerRatings.filter((r) => r.guess != null && r.guess.trim() !== "");
      const correct = withGuess.filter((r) => {
        const actual = revealByNumber.get(r.beer_number)?.beer_name?.trim().toLowerCase() ?? "";
        return actual && r.guess?.trim().toLowerCase() === actual;
      }).length;

      return {
        player,
        overallRanked,
        tasteRanked,
        crushRanked,
        guessAccuracy,
        avgTaste,
        avgCrush,
        correctGuesses: correct,
        totalGuesses: withGuess.length,
      };
    });
  }, [players, ratings, revealByNumber]);

  return (
    <div className="space-y-10">
      <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-heading)]">
        🍺 {sessionName} — Final Scorecards
      </h1>

      {playerScorecards.map(({ player, overallRanked, tasteRanked, crushRanked, guessAccuracy, avgTaste, avgCrush, correctGuesses, totalGuesses }) => (
        <section
          key={player.id}
          className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-amber)] overflow-hidden"
        >
          <h2 className="bg-[var(--progress-track)] text-[var(--text-heading)] font-bold px-4 py-3 border-b border-[var(--border-amber)]">
            {player.name}
          </h2>

          <div className="p-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-[var(--amber-gold)] mb-2">Overall</h3>
                <ol className="text-sm text-[var(--text-body)] space-y-1 list-decimal list-inside">
                  {overallRanked.map((item) => (
                    <li key={item.beerNumber}>
                      {item.name} — {item.combined.toFixed(1)}/10
                    </li>
                  ))}
                  {overallRanked.length === 0 && <li className="list-none text-[var(--text-muted)]">No ratings</li>}
                </ol>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--amber-gold)] mb-2">Taste</h3>
                <ol className="text-sm text-[var(--text-body)] space-y-1 list-decimal list-inside">
                  {tasteRanked.map((item) => (
                    <li key={item.beerNumber}>
                      {item.name} — {item.score}/10
                    </li>
                  ))}
                  {tasteRanked.length === 0 && <li className="list-none text-[var(--text-muted)]">No ratings</li>}
                </ol>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--amber-gold)] mb-2">Crushability</h3>
                <ol className="text-sm text-[var(--text-body)] space-y-1 list-decimal list-inside">
                  {crushRanked.map((item) => (
                    <li key={item.beerNumber}>
                      {item.name} — {item.score}/10
                    </li>
                  ))}
                  {crushRanked.length === 0 && <li className="list-none text-[var(--text-muted)]">No ratings</li>}
                </ol>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[var(--amber-gold)] mb-2">Guess accuracy</h3>
              <ul className="text-sm space-y-1.5">
                {guessAccuracy.map((g, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[var(--text-heading)]">{g.beerName}</span>
                    <span className="text-[var(--text-muted)]">— {g.guess || "(no guess)"}</span>
                    <span>{g.result}</span>
                  </li>
                ))}
                {guessAccuracy.length === 0 && (
                  <li className="text-[var(--text-muted)]">No ratings</li>
                )}
              </ul>
            </div>

            <div className="pt-2 border-t border-[var(--border-amber)] text-sm text-[var(--text-muted)]">
              Avg taste: <span className="text-[var(--text-heading)] font-medium">{avgTaste.toFixed(1)}/10</span>
              {" · "}
              Avg crushability: <span className="text-[var(--text-heading)] font-medium">{avgCrush.toFixed(1)}/10</span>
              {" · "}
              Correct guesses: <span className="text-[var(--text-heading)] font-medium">{correctGuesses} out of {totalGuesses}</span>
            </div>
          </div>
        </section>
      ))}

      {playerScorecards.length === 0 && (
        <p className="text-[var(--text-muted)]">No players or ratings yet.</p>
      )}
    </div>
  );
}
