"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";

export default function SessionDonePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string) ?? "";
  const [playerName, setPlayerName] = useState("");
  const [beerCount, setBeerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const name = typeof window !== "undefined" ? sessionStorage.getItem("player_name") : null;
    const storedCode = typeof window !== "undefined" ? sessionStorage.getItem("player_session_code") : null;
    if (!name || storedCode !== code) {
      router.replace(`/session/${code}`);
      return;
    }
    setPlayerName(name);
    const supabase = createSupabaseClient();
    supabase
      .from("sessions")
      .select("beer_count")
      .eq("code", code)
      .single()
      .then(({ data }) => {
        if (data) setBeerCount(data.beer_count);
        setLoading(false);
      });
  }, [code, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--amber-dark)] text-[var(--amber-light)] flex items-center justify-center">
        <p className="text-[var(--amber-muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--amber-dark)] text-[var(--amber-light)] flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-[480px] mx-auto text-center space-y-6">
        <h1 className="text-3xl font-bold text-[var(--amber-light)]">
          🎉 You&apos;re done! Thanks {playerName}!
        </h1>
        <p className="text-[var(--amber-muted)] text-lg">
          You rated all {beerCount} beers.
        </p>
        <p className="text-[var(--amber-light)]/90">
          Now sit back and wait for the reveal…
        </p>
        <Link
          href="/"
          className="inline-block mt-6 rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-warm)] text-[var(--amber-darker)] font-bold px-6 py-3 transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
