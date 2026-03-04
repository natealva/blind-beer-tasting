"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseClient } from "@/lib/supabase";
import { getCriteria } from "@/lib/criteriaUtils";
import { getItemLabel, getItemEmoji, isBeer } from "@/lib/tastingUtils";
import type { Rating, Session } from "@/types/database";
import { BEER_GIFS, getRandomBeerGif } from "@/lib/beerGifs";

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
}: {
  rows: { beerNumber: number; userScore: number }[];
  getValue: (r: { userScore: number }) => number;
  getGroupAvg: (beerNumber: number) => number;
  title: string;
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
                const groupLineBottomPx = groupAvg >= 0 && groupAvg <= 10 ? pxFromScore(groupAvg) : null;
                const barHeightPx = pxFromScore(userScore);
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

export default function SessionDonePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string) ?? "";
  const [playerName, setPlayerName] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [criteria, setCriteria] = useState(getCriteria(null));
  const [ratings, setRatings] = useState<Rating[]>([]);
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
        setCriteria(getCriteria(session));
        Promise.all([
          supabase.from("ratings").select("*").eq("session_id", session.id).eq("player_id", playerId),
          supabase.from("ratings").select("*").eq("session_id", session.id),
        ]).then(([ratRes, allRes]) => {
          setRatings(ratRes.data ?? []);
          setAllSessionRatings(allRes.data ?? []);
          setLoading(false);
        });
      });
  }, [code, router]);

  const sortedRatings = useMemo(() => [...ratings].sort((a, b) => a.beer_number - b.beer_number), [ratings]);

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

  const withScores = useMemo(() => sortedRatings.filter((r) => r.taste != null && r.crushability != null), [sortedRatings]);

  const myOverallRanked = useMemo(
    () =>
      [...withScores]
        .map((r) => ({ beerNumber: r.beer_number, combined: getOverallScoreSimple(r) }))
        .sort((a, b) => b.combined - a.combined),
    [withScores]
  );

  const myRankedByCriterion = useMemo(
    () =>
      scoringCriteria.map((c, idx) => ({
        criterion: c,
        ranked: [...withScores]
          .map((r) => ({ beerNumber: r.beer_number, score: getScoreForCriterionIndex(r, idx as 0 | 1) ?? 0 }))
          .sort((a, b) => b.score - a.score),
      })),
    [withScores, scoringCriteria]
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

  const itemLabel = session ? getItemLabel(session) : "Beer";

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-[480px] mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-[var(--text-heading)] text-center">
          🎉 You&apos;re done, {playerName}!
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
        <div className="space-y-4">
          {!hasRatings ? (
            <p className="text-[var(--text-muted)] text-center">
              You haven&apos;t rated any {itemLabel}
              {itemLabel.endsWith("s") ? "" : "s"} yet.
            </p>
          ) : (
            sortedRatings.map((r) => (
              <div
                key={r.id}
                className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-amber)] overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
                  <span className="font-mono font-bold text-[var(--amber-gold)]">
                    {itemLabel} #{r.beer_number}
                  </span>
                </div>
                <div className="px-4 py-3 space-y-1 text-sm">
                  {scoringCriteria.map((c, idx) => {
                    const score = getScoreForCriterionIndex(r, idx as 0 | 1);
                    return (
                      <div key={c.id} className="text-[var(--text-body)]">
                        {c.emoji} {c.label}: <span style={{ color: "#d97706", fontWeight: 700 }}>{score ?? "—"}</span>/10
                      </div>
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
            ))
          )}
        </div>

        {withScores.length > 0 && (
          <>
            <section>
              <h2 className="text-lg font-bold text-[var(--text-heading)] mb-3">My Rankings</h2>
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
                      <span className="font-bold">{idx + 1}.</span> {itemLabel} #{row.beerNumber} — {row.combined.toFixed(1)}
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
                      <span className="font-bold">{idx + 1}.</span> {itemLabel} #{row.beerNumber} — {row.score.toFixed(1)}
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
                  />
                ))}
              </div>
            </section>
          </>
        )}

        <p className="text-[var(--text-body)] text-center">
          Now sit back and wait for the reveal! {getItemEmoji(session)}
        </p>

        <Link
          href={`/session/${code}/play`}
          className="block w-full text-center rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] text-[var(--button-text)] font-bold py-3.5 transition-colors"
        >
          ← Keep Rating {itemLabel}
          {itemLabel.endsWith("s") ? "" : "s"}
        </Link>
        <Link
          href="/"
          className="block w-full text-center rounded-xl bg-white border-2 border-[var(--border-amber)] hover:bg-amber-50 text-[var(--text-heading)] font-bold py-3.5 transition-colors"
        >
          Back to Home
        </Link>

        <Link
          href={`/session/${code}/reveal`}
          className="block w-full text-center rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] text-[var(--button-text)] font-bold py-3.5 transition-colors border-2 border-amber-800"
        >
          🎉 Ready for the big reveal?
        </Link>
        <p style={{ fontSize: 13, color: "#92400e", textAlign: "center", marginTop: 6 }}>
          ⚠️ This will lock all your previous answers
        </p>
      </div>
    </div>
  );
}
