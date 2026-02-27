"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";
import type { BeerReveal, Player, Rating } from "@/types/database";
import { ScorecardsContent } from "./ScorecardsContent";

export default function SessionScorecardsPage() {
  const params = useParams();
  const code = (params?.code as string) ?? "";
  const [session, setSession] = useState<{ id: string; name: string; beer_count: number } | null>(null);
  const [reveals, setReveals] = useState<BeerReveal[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) {
      setLoading(false);
      return;
    }
    const supabase = createSupabaseClient();
    supabase
      .from("sessions")
      .select("id, name, beer_count")
      .eq("code", code)
      .single()
      .then(({ data: sess, error }) => {
        if (error || !sess) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setSession(sess);
        Promise.all([
          supabase.from("beer_reveals").select("*").eq("session_id", sess.id).order("beer_number"),
          supabase.from("players").select("*").eq("session_id", sess.id).order("created_at", { ascending: true }),
          supabase.from("ratings").select("*").eq("session_id", sess.id),
        ]).then(([revRes, playRes, ratRes]) => {
          setReveals(revRes.data ?? []);
          setPlayers(playRes.data ?? []);
          setRatings(ratRes.data ?? []);
          setLoading(false);
        });
      });
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading scorecards…</p>
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Session not found.</p>
          <Link href="/" className="text-[var(--amber-gold)] hover:underline">Go home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/" className="inline-block text-[var(--amber-gold)] hover:underline text-sm mb-6">
          ← Home
        </Link>
        <ScorecardsContent
          sessionName={session.name}
          reveals={reveals}
          players={players}
          ratings={ratings}
        />
      </div>
    </div>
  );
}
