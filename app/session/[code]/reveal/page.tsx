"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseClient } from "@/lib/supabase";
import type { Rating, BeerReveal } from "@/types/database";
import { BEER_GIFS, getRandomBeerGif } from "@/lib/beerGifs";

const CHART_HEIGHT_PX = 200;
const BAR_WIDTH_PX = 32;
const Y_AXIS_VALUES = [10, 8, 6, 4, 2, 0];

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
              const userScore = getValue(row);
              const groupAvg = getGroupAvg(row.beerNumber);
              const barPct = Math.max(0, (userScore / 10) * 100);
              const groupLinePct = groupAvg >= 0 && groupAvg <= 10 ? (groupAvg / 10) * 100 : null;
              const isAboveAvg = userScore >= groupAvg;
              const barColor = isAboveAvg ? "bg-amber-500" : "bg-amber-300";
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
                    {groupLinePct != null && groupLinePct > 0 && (
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
            {rows.map((row) => {
              const beerName = getBeerName?.(row.beerNumber) ?? null;
              return (
                <div
                  key={row.beerNumber}
                  className="shrink-0 text-center text-xs w-full"
                  style={{ width: BAR_WIDTH_PX }}
                >
                  <div className="text-[var(--text-muted)]">Beer #{row.beerNumber}</div>
                  {beerName && (
                    <div className="text-amber-700 font-semibold truncate" title={beerName}>{beerName}</div>
                  )}
                </div>
              );
            })}
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
          supabase.from("ratings").select("*").eq("session_id", session.id),
        ]).then(([ratRes, revRes, allRes]) => {
          setRatings(ratRes.data ?? []);
          setReveals(revRes.data ?? []);
          setAllSessionRatings(allRes.data ?? []);
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

  const myOverallRanked = useMemo(
    () =>
      [...withScores]
        .map((r) => ({
          beerNumber: r.beer_number,
          name: revealByNumber.get(r.beer_number)?.beer_name ?? null,
          combined: ((r.crushability ?? 0) + (r.taste ?? 0)) / 2,
        }))
        .sort((a, b) => b.combined - a.combined),
    [withScores, revealByNumber]
  );
  const myTasteRanked = useMemo(
    () =>
      [...withScores]
        .map((r) => ({
          beerNumber: r.beer_number,
          name: revealByNumber.get(r.beer_number)?.beer_name ?? null,
          taste: r.taste ?? 0,
        }))
        .sort((a, b) => b.taste - a.taste),
    [withScores, revealByNumber]
  );
  const myCrushRanked = useMemo(
    () =>
      [...withScores]
        .map((r) => ({
          beerNumber: r.beer_number,
          name: revealByNumber.get(r.beer_number)?.beer_name ?? null,
          crush: r.crushability ?? 0,
        }))
        .sort((a, b) => b.crush - a.crush),
    [withScores, revealByNumber]
  );

  const groupAvgByBeer = useMemo(() => {
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
    return {
      taste: (n: number) => avg(tasteByBeer.get(n) ?? []),
      crush: (n: number) => avg(crushByBeer.get(n) ?? []),
    };
  }, [allSessionRatings]);

  const chartTasteRows = useMemo(
    () =>
      withScores
        .map((r) => ({ beerNumber: r.beer_number, userScore: r.taste ?? 0 }))
        .sort((a, b) => a.beerNumber - b.beerNumber),
    [withScores]
  );
  const chartCrushRows = useMemo(
    () =>
      withScores
        .map((r) => ({ beerNumber: r.beer_number, userScore: r.crushability ?? 0 }))
        .sort((a, b) => a.beerNumber - b.beerNumber),
    [withScores]
  );

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
          🍺 The Big Reveal!
        </h1>
        <Image
          src={gifSrc}
          alt="Beer cheers"
          width={120}
          height={120}
          unoptimized
          className="mx-auto rounded-lg"
        />
        <p className="text-[var(--text-muted)] text-center text-sm">
          Here&apos;s your summary with the actual beer names, {playerName}.
        </p>

        <div className="space-y-4">
          {sortedRatings.length === 0 ? (
            <p className="text-[var(--text-muted)] text-center">You haven&apos;t rated any beers yet.</p>
          ) : (
            sortedRatings.map((r) => {
              const rev = revealByNumber.get(r.beer_number);
              return (
                <div
                  key={r.id}
                  className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-amber)] overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
                    <span className="font-mono font-bold text-[var(--amber-gold)]">Beer #{r.beer_number}</span>
                    {rev?.beer_name && (
                      <span className="ml-2 text-[var(--text-heading)] font-medium">{rev.beer_name}</span>
                    )}
                  </div>
                  <div className="px-4 py-3 space-y-1 text-sm">
                    <p className="text-[var(--text-body)]">
                      Crushability: <span className="font-semibold text-[var(--amber-gold)]">{r.crushability ?? "—"}</span>/10
                    </p>
                    <p className="text-[var(--text-body)]">
                      Taste: <span className="font-semibold text-[var(--amber-gold)]">{r.taste ?? "—"}</span>/10
                    </p>
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
              Crushability: <span className="font-bold text-[var(--amber-gold)]">{avgCrush.toFixed(1)}</span>/10
              {" · "}
              Taste: <span className="font-bold text-[var(--amber-gold)]">{avgTaste.toFixed(1)}</span>/10
            </p>
          </div>
        )}

        {withScores.length > 0 && (
          <>
            <section>
              <h2 className="text-lg font-bold text-[var(--text-heading)] mb-3">My Rankings (Revealed)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-amber)] p-3">
                  <h3 className="text-sm font-bold text-[var(--text-heading)] mb-2">My Overall Top Beers</h3>
                  <ul className="text-sm space-y-1">
                    {myOverallRanked.map((row, idx) => (
                      <li key={row.beerNumber}>
                        <span className="font-bold">{idx + 1}.</span> Beer #{row.beerNumber}{row.name ? ` · ${row.name}` : ""} — {row.combined.toFixed(1)}/10
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-amber)] p-3">
                  <h3 className="text-sm font-bold text-[var(--text-heading)] mb-2">My Top by Taste</h3>
                  <ul className="text-sm space-y-1">
                    {myTasteRanked.map((row, idx) => (
                      <li key={row.beerNumber}>
                        #{idx + 1} Beer #{row.beerNumber}{row.name ? ` · ${row.name}` : ""} — {row.taste.toFixed(1)}/10
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-amber)] p-3">
                  <h3 className="text-sm font-bold text-[var(--text-heading)] mb-2">My Top by Crushability</h3>
                  <ul className="text-sm space-y-1">
                    {myCrushRanked.map((row, idx) => (
                      <li key={row.beerNumber}>
                        <span className="font-bold">{idx + 1}.</span> Beer #{row.beerNumber}{row.name ? ` · ${row.name}` : ""} — {row.crush.toFixed(1)}/10
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--text-heading)] mb-3">My Scores vs Group Average</h2>
              <div className="space-y-4">
                <UserVsGroupChart
                  rows={chartTasteRows}
                  getValue={(r) => r.userScore}
                  getGroupAvg={groupAvgByBeer.taste}
                  title="How your taste ratings compare"
                  getBeerName={(n) => revealByNumber.get(n)?.beer_name ?? null}
                />
                <UserVsGroupChart
                  rows={chartCrushRows}
                  getValue={(r) => r.userScore}
                  getGroupAvg={groupAvgByBeer.crush}
                  title="How your crushability ratings compare"
                  getBeerName={(n) => revealByNumber.get(n)?.beer_name ?? null}
                />
              </div>
            </section>
          </>
        )}

        <div className="flex flex-col gap-3">
          <Link
            href={`/session/${code}/play`}
            className="block w-full text-center rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] text-[var(--button-text)] font-bold py-3.5 transition-colors"
          >
            ← Keep Rating Beers
          </Link>
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
