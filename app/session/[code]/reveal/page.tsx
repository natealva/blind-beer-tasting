"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import html2canvas from "html2canvas";
import { createSupabaseClient } from "@/lib/supabase";
import { getCriteria } from "@/lib/criteriaUtils";
import type { Rating, BeerReveal, Session } from "@/types/database";
import { BEER_GIFS, getRandomBeerGif } from "@/lib/beerGifs";
import { getItemLabel, getItemEmoji, isBeer } from "@/lib/tastingUtils";

const CHART_HEIGHT = 200;
const BAR_WIDTH = 44;

function pxFromScore(score: number): number {
  return Math.max(0, (score / 10) * CHART_HEIGHT);
}

function UserVsGroupChart({
  rows,
  getValue,
  getGroupAvg,
  title,
  getBeerName,
}: {
  rows: { beerNumber: number; userScore: number }[];
  getValue: (r: { userScore: number }) => number;
  getGroupAvg: (beerNumber: number) => number;
  title: string;
  getBeerName?: (beerNumber: number) => string | null;
}) {
  return (
    <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-amber)] p-4">
      <h3 className="text-sm font-bold text-[var(--text-heading)] mb-2">{title}</h3>
      <p className="text-[10px] text-[var(--text-muted)] mb-2">▬ Group average</p>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "4px" }}>
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
                const userScore = getValue(row);
                const groupAvg = getGroupAvg(row.beerNumber);
                const barHeightPx = pxFromScore(userScore);
                const groupLineBottomPx = groupAvg >= 0 && groupAvg <= 10 ? pxFromScore(groupAvg) : null;
                const barColor = userScore >= groupAvg ? "#d97706" : "#fbbf24";
                return (
                  <div key={row.beerNumber} style={{ position: "relative", height: "200px", width: `${BAR_WIDTH}px`, flexShrink: 0 }}>
                    {groupLineBottomPx != null && groupLineBottomPx > 0 && (
                      <div style={{ position: "absolute", bottom: `${groupLineBottomPx}px`, left: 0, right: 0, height: "2px", background: "#7f1d1d", zIndex: 2, pointerEvents: "none" }} title={`Group avg: ${groupAvg.toFixed(1)}`} />
                    )}
                    <div style={{ position: "absolute", bottom: 0, left: 0, height: `${barHeightPx}px`, width: `${BAR_WIDTH}px`, background: barColor, borderRadius: "4px 4px 0 0", minHeight: barHeightPx > 0 ? 2 : 0 }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "12px", padding: "4px 8px 0" }}>
              {rows.map((row) => {
                const beerName = getBeerName?.(row.beerNumber) ?? null;
                const label = beerName ?? `#${row.beerNumber}`;
                return (
                  <div
                    key={row.beerNumber}
                    style={{ width: "44px", fontSize: "10px", textAlign: "center", color: "#92400e", flexShrink: 0, wordBreak: "break-word", lineHeight: "1.2" }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SessionRevealPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string) ?? "";
  const [playerName, setPlayerName] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [criteria, setCriteria] = useState(getCriteria(null));
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [reveals, setReveals] = useState<BeerReveal[]>([]);
  const [allSessionRatings, setAllSessionRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [gifSrc, setGifSrc] = useState(BEER_GIFS[0]);

  useEffect(() => {
    setGifSrc(getRandomBeerGif());
  }, []);

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
      .select("*")
      .eq("code", code)
      .single()
      .then(({ data: session, error }) => {
        if (error || !session) {
          setLoading(false);
          return;
        }
        setSession(session as Session);
        setSessionName((session as { id: string; name: string }).name ?? "");
        setCriteria(getCriteria(session));
        Promise.all([
          supabase.from("ratings").select("*").eq("session_id", session.id).eq("player_id", playerId),
          supabase.from("beer_reveals").select("*").eq("session_id", session.id).order("beer_number"),
          supabase.from("ratings").select("*").eq("session_id", session.id),
        ]).then(async ([ratRes, revRes, allRes]) => {
          setRatings(ratRes.data ?? []);
          setReveals(revRes.data ?? []);
          setAllSessionRatings(allRes.data ?? []);
          await supabase
            .from("ratings")
            .update({ locked: true })
            .eq("session_id", session.id)
            .eq("player_id", playerId);
          setLoading(false);
        });
      });
  }, [code, router]);

  const sortedRatings = useMemo(() => [...ratings].sort((a, b) => a.beer_number - b.beer_number), [ratings]);
  const revealByNumber = useMemo(() => new Map(reveals.map((r) => [r.beer_number, r])), [reveals]);

  const scoringCriteria = useMemo(() => criteria.slice(0, 2), [criteria]);

  function getScoreForCriterionIndex(r: Rating, idx: 0 | 1): number | null {
    if (idx === 0) return r.taste ?? null;
    return r.crushability ?? null;
  }

  function getOverallScoreSimple(r: Rating): number {
    const t = r.taste;
    const c = r.crushability;
    if (t == null || c == null) return 0;
    return (t + c) / 2;
  }

  const hasRatings = useMemo(
    () =>
      ratings.length > 0 && ratings.some((r) => r.taste != null || r.crushability != null),
    [ratings]
  );

  const withScores = useMemo(
    () => sortedRatings.filter((r) => r.taste != null && r.crushability != null),
    [sortedRatings]
  );

  // criteria is stable for a given session; we intentionally omit it from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const avgByCriterion = useMemo(() => {
    return scoringCriteria.map((c, idx) => ({
      criterion: c,
      avg: withScores.length
        ? withScores.reduce((s, r) => s + (getScoreForCriterionIndex(r, idx as 0 | 1) ?? 0), 0) / withScores.length
        : 0,
    }));
  }, [withScores]);

  const myOverallRanked = useMemo(
    () =>
      [...withScores]
        .map((r) => ({
          beerNumber: r.beer_number,
          name: revealByNumber.get(r.beer_number)?.beer_name ?? null,
          combined: getOverallScoreSimple(r),
        }))
        .sort((a, b) => b.combined - a.combined),
    [withScores, revealByNumber]
  );

  const myRankedByCriterion = useMemo(
    () =>
      scoringCriteria.map((c, idx) => ({
        criterion: c,
        ranked: [...withScores]
          .map((r) => ({
            beerNumber: r.beer_number,
            name: revealByNumber.get(r.beer_number)?.beer_name ?? null,
            score: getScoreForCriterionIndex(r, idx as 0 | 1) ?? 0,
          }))
          .sort((a, b) => b.score - a.score),
      })),
    [withScores, scoringCriteria, revealByNumber]
  );

  const groupAvgByBeer = useMemo(() => {
    const byCriterionAndBeer = new Map<number, Map<number, number[]>>();
    for (let idx = 0; idx < scoringCriteria.length; idx++) {
      byCriterionAndBeer.set(idx, new Map());
    }
    for (const r of allSessionRatings) {
      for (let idx = 0; idx < scoringCriteria.length; idx++) {
        const s = getScoreForCriterionIndex(r, idx as 0 | 1);
        if (s != null) {
          const byBeer = byCriterionAndBeer.get(idx)!;
          const arr = byBeer.get(r.beer_number) ?? [];
          arr.push(s);
          byBeer.set(r.beer_number, arr);
        }
      }
    }
    const avg = (arr: number[]) => (arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0);
    return (criterionIndex: number) => (beerNumber: number) => {
      const byBeer = byCriterionAndBeer.get(criterionIndex);
      return byBeer ? avg(byBeer.get(beerNumber) ?? []) : 0;
    };
  }, [allSessionRatings, scoringCriteria]);

  const beerNumbersWithGroupRatings = useMemo(() => {
    const set = new Set<number>();
    for (const r of allSessionRatings) {
      if (r.taste != null || r.crushability != null) set.add(r.beer_number);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [allSessionRatings]);

  const groupOverallRanked = useMemo(
    () =>
      beerNumbersWithGroupRatings
        .map((beerNumber) => {
          const combined =
            scoringCriteria.length > 0
              ? scoringCriteria.reduce((sum, _c, idx) => sum + groupAvgByBeer(idx)(beerNumber), 0) / scoringCriteria.length
              : 0;
          const name = revealByNumber.get(beerNumber)?.beer_name ?? `${itemLabel} #${beerNumber}`;
          return { beerNumber, name, combined };
        })
        .sort((a, b) => b.combined - a.combined),
    // criteria and itemLabel are stable per session; omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [beerNumbersWithGroupRatings, groupAvgByBeer, revealByNumber, scoringCriteria]
  );

  const groupRankedByCriterion = useMemo(
    () =>
      scoringCriteria.map((c, idx) => ({
        criterion: c,
        ranked: beerNumbersWithGroupRatings
          .map((beerNumber) => ({
            beerNumber,
            name: revealByNumber.get(beerNumber)?.beer_name ?? `${itemLabel} #${beerNumber}`,
            score: groupAvgByBeer(idx)(beerNumber),
          }))
          .sort((a, b) => b.score - a.score),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [beerNumbersWithGroupRatings, groupAvgByBeer, revealByNumber, scoringCriteria]
  );

  const chartRowsByCriterion = useMemo(
    () =>
      scoringCriteria.map((c, idx) => ({
        criterion: c,
        rows: withScores
          .map((r) => ({ beerNumber: r.beer_number, userScore: getScoreForCriterionIndex(r, idx as 0 | 1) ?? 0 }))
          .sort((a, b) => a.beerNumber - b.beerNumber),
      })),
    [withScores, scoringCriteria]
  );

  const myGuessesForScorecard = useMemo(
    () =>
      sortedRatings.map((r) => {
        const beerName = revealByNumber.get(r.beer_number)?.beer_name ?? `${itemLabel} #${r.beer_number}`;
        const guess = r.guess?.trim() ?? "";
        const actual = revealByNumber.get(r.beer_number)?.beer_name?.trim().toLowerCase() ?? "";
        const result = !guess ? "—" : actual && guess.toLowerCase() === actual ? "✅" : "❌";
        return { beerName, guess: guess || "(no guess)", result };
      }),
    [sortedRatings, revealByNumber]
  );

  const itemLabel = session ? getItemLabel(session) : "Beer";

  const handleDownload = useCallback(async () => {
    const element = document.getElementById("scorecard-download");
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 3, useCORS: true });
    const link = document.createElement("a");
    link.download = `${playerName}-beer-scorecard.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [playerName]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex flex-col items-center px-4 py-12">
      {/* Hidden div for scorecard image export */}
      <div
        id="scorecard-download"
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: "560px",
          padding: "32px",
          background: "#fffbeb",
          fontFamily: "Nunito, sans-serif",
          color: "#451a03",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "32px" }}>🍺</div>
          <div style={{ fontSize: "22px", fontWeight: 800 }}>{sessionName || "Blind Beer Tasting"}</div>
          <div style={{ fontSize: "16px", fontWeight: 600 }}>{playerName}&apos;s Scorecard</div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "8px", color: "#92400e" }}>MY RANKINGS</div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${1 + criteria.length}, 1fr)`, gap: "12px", fontSize: "9px", lineHeight: "1.4" }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: "4px" }}>Overall</div>
              {myOverallRanked.map((row, idx) => (
                <div key={row.beerNumber} style={{ whiteSpace: "normal" }}>
                  {idx + 1}. {row.name ?? `${itemLabel} #${row.beerNumber}`} — {row.combined.toFixed(1)}
                </div>
              ))}
              {myOverallRanked.length === 0 && <div style={{ color: "#92400e" }}>—</div>}
            </div>
            {myRankedByCriterion.map(({ criterion, ranked }) => (
              <div key={criterion.id}>
                <div style={{ fontWeight: 700, marginBottom: "4px" }}>{criterion.label}</div>
                {ranked.map((row, idx) => (
                  <div key={row.beerNumber} style={{ whiteSpace: "normal" }}>
                    {idx + 1}. {row.name ?? `${itemLabel} #${row.beerNumber}`} — {row.score.toFixed(1)}
                  </div>
                ))}
                {ranked.length === 0 && <div style={{ color: "#92400e" }}>—</div>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "8px", color: "#92400e" }}>MY GUESSES</div>
          <div style={{ fontSize: "9px", lineHeight: "1.4" }}>
            {myGuessesForScorecard.map((g, idx) => (
              <div key={idx} style={{ whiteSpace: "normal" }}>{g.beerName} · Guessed: {g.guess} · {g.result}</div>
            ))}
            {myGuessesForScorecard.length === 0 && <div style={{ color: "#92400e" }}>—</div>}
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "8px", color: "#92400e" }}>GROUP RANKINGS</div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${1 + criteria.length}, 1fr)`, gap: "12px", fontSize: "9px", lineHeight: "1.4" }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: "4px" }}>Overall</div>
              {groupOverallRanked.map((row, idx) => (
                <div key={row.beerNumber} style={{ whiteSpace: "normal" }}>
                  {idx + 1}. {row.name} — {row.combined.toFixed(1)}
                </div>
              ))}
              {groupOverallRanked.length === 0 && <div style={{ color: "#92400e" }}>—</div>}
            </div>
            {groupRankedByCriterion.map(({ criterion, ranked }) => (
              <div key={criterion.id}>
                <div style={{ fontWeight: 700, marginBottom: "4px" }}>{criterion.label}</div>
                {ranked.map((row, idx) => (
                  <div key={row.beerNumber} style={{ whiteSpace: "normal" }}>
                    {idx + 1}. {row.name} — {row.score.toFixed(1)}
                  </div>
                ))}
                {ranked.length === 0 && <div style={{ color: "#92400e" }}>—</div>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #fcd34d", fontSize: "11px", color: "#92400e" }}>
          Want to host your own tasting? Visit:<br />
          <strong>blind-beer-tasting.vercel.app</strong>
        </div>
      </div>

      <div className="w-full max-w-[480px] mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-[var(--text-heading)] text-center">
          {getItemEmoji(session)} The Big Reveal!
        </h1>
        {session && isBeer(session) && (
          <Image
            src={gifSrc}
            alt="Beer cheers"
            width={120}
            height={120}
            unoptimized
            className="mx-auto rounded-lg"
          />
        )}
        <p className="text-[var(--text-muted)] text-center text-sm">
          Here&apos;s your summary with the actual {itemLabel.toLowerCase()} names,{" "}
          {playerName}.
        </p>

        <div className="space-y-4">
          {!hasRatings ? (
            <p className="text-[var(--text-muted)] text-center">
              You haven&apos;t rated any {itemLabel}
              {itemLabel.endsWith("s") ? "" : "s"} yet.
            </p>
          ) : (
            sortedRatings.map((r) => {
              const rev = revealByNumber.get(r.beer_number);
              return (
                <div
                  key={r.id}
                  className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-amber)] overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
                    <span className="font-mono font-bold text-[var(--amber-gold)]">
                      {itemLabel} #{r.beer_number}
                    </span>
                    {rev?.beer_name && (
                      <span className="ml-2 text-[var(--text-heading)] font-medium">{rev.beer_name}</span>
                    )}
                  </div>
                  <div className="px-4 py-3 space-y-1 text-sm">
                    {scoringCriteria.map((c, idx) => {
                      const score = getScoreForCriterionIndex(r, idx as 0 | 1);
                      return (
                        <p key={c.id} className="text-[var(--text-body)]">
                          {c.emoji} {c.label}: <span className="font-semibold text-[var(--amber-gold)]">{score ?? "—"}</span>/10
                        </p>
                      );
                    })}
                    {r.guess && (
                      <p className="text-[var(--text-muted)]">
                        Your guess: <span className="text-[var(--text-body)]">{r.guess}</span>
                      </p>
                    )}
                    {r.notes && (
                      <p className="text-[var(--text-muted)]">
                        Notes: <span className="text-[var(--text-body)]">{r.notes}</span>
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {withScores.length > 0 && (
          <div className="rounded-xl bg-[var(--bg-card)] border-2 border-[var(--amber-gold)] px-4 py-3 text-center">
            <p className="text-[var(--text-muted)] text-sm mb-1">Your averages</p>
            <p className="text-[var(--text-body)]">
              {avgByCriterion.map(({ criterion, avg }, i) => (
                <span key={criterion.id}>
                  {i > 0 ? " · " : ""}
                  {criterion.label}: <span className="font-bold text-[var(--amber-gold)]">{avg.toFixed(1)}</span>/10
                </span>
              ))}
            </p>
          </div>
        )}

        {withScores.length > 0 && (
          <>
            <section>
              <h2 className="text-lg font-bold text-[var(--text-heading)] mb-3">My Rankings (Revealed)</h2>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  overflowX: "auto",
                  width: "100%",
                  paddingBottom: "8px",
                }}
              >
                <div
                  className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-amber)] p-3"
                  style={{ flexShrink: 0, minWidth: "140px" }}
                >
                  <h3 className="text-sm font-bold text-[var(--text-heading)] mb-2">My Overall Top Beers</h3>
                  {myOverallRanked.map((row, idx) => (
                    <div
                      key={row.beerNumber}
                      style={{ whiteSpace: "nowrap", fontSize: "13px", marginBottom: "4px" }}
                    >
                      <span className="font-bold">{idx + 1}.</span> {row.name ?? `${itemLabel} #${row.beerNumber}`} — {row.combined.toFixed(1)}
                    </div>
                  ))}
                </div>
                {myRankedByCriterion.map(({ criterion, ranked }) => (
                  <div
                    key={criterion.id}
                    className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-amber)] p-3"
                    style={{ flexShrink: 0, minWidth: "140px" }}
                  >
                    <h3 className="text-sm font-bold text-[var(--text-heading)] mb-2">My Top by {criterion.label}</h3>
                    {ranked.map((row, idx) => (
                      <div
                        key={row.beerNumber}
                        style={{ whiteSpace: "nowrap", fontSize: "13px", marginBottom: "4px" }}
                      >
                        <span className="font-bold">{idx + 1}.</span> {row.name ?? `${itemLabel} #${row.beerNumber}`} — {row.score.toFixed(1)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--text-heading)] mb-3">My Scores vs Group Average</h2>
              <div className="space-y-4">
                {chartRowsByCriterion.map(({ criterion, rows }, idx) => (
                  <UserVsGroupChart
                    key={criterion.id}
                    rows={rows}
                    getValue={(r) => r.userScore}
                    getGroupAvg={groupAvgByBeer(idx)}
                    title={`How your ${criterion.label} ratings compare`}
                    getBeerName={(n) => revealByNumber.get(n)?.beer_name ?? null}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleDownload}
            className="block w-full text-center rounded-xl bg-white border-2 border-[var(--border-amber)] hover:bg-amber-50 text-[var(--text-heading)] font-bold py-3.5 transition-colors"
          >
            📱 Download Your Scorecard
          </button>
          <Link
            href="/"
            className="block w-full text-center rounded-xl bg-white border-2 border-[var(--border-amber)] hover:bg-amber-50 text-[var(--text-heading)] font-bold py-3.5 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
