"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseClient } from "@/lib/supabase";
import { BEER_GIFS, getRandomBeerGif } from "@/lib/beerGifs";
import { generateSessionCode } from "@/lib/code";

export default function CreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [beerCount, setBeerCount] = useState(13);
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [gifSrc, setGifSrc] = useState(BEER_GIFS[0]);
  useEffect(() => {
    setGifSrc(getRandomBeerGif());
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseClient();
    let code = generateSessionCode(6);
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      const { data, error: insertError } = await supabase
        .from("sessions")
        .insert({
          code,
          name: name.trim() || "Blind Tasting",
          beer_count: Math.min(99, Math.max(1, beerCount)),
          admin_password: adminPassword || "admin",
        })
        .select("id, code")
        .single();
      if (!insertError) {
        const pwd = adminPassword || "admin";
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`blind_beer_admin_${data.code}`, pwd);
        }
        setCreatedCode(data.code);
        setLoading(false);
        return;
      }
      if (insertError.code === "23505") {
        code = generateSessionCode(6);
        continue;
      }
      setError(insertError.message);
      setLoading(false);
      return;
    }
    setError("Could not generate unique code. Try again.");
    setLoading(false);
  }

  function goToAdmin() {
    if (createdCode) router.push(`/session/${createdCode}/admin`);
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-[480px] mx-auto">
        <Link href="/" className="text-[var(--text-muted)] hover:text-[var(--amber-gold)] text-sm mb-6 inline-block">
          ← Back
        </Link>
        <Image
          src={gifSrc}
          alt="Beer cheers"
          width={120}
          height={120}
          unoptimized
          className="mx-auto mb-4 rounded-lg"
        />
        {!createdCode ? (
          <>
            <h1 className="text-2xl font-bold text-[var(--text-heading)] mb-6">Create a tasting session</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[var(--text-muted)] text-sm font-medium mb-1">Session name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Nate's Beer Night"
                  className="w-full rounded-lg bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-3 py-2.5 placeholder-amber-500 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)]"
                />
              </div>
              <div>
                <label className="block text-[var(--text-muted)] text-sm font-medium mb-1">Number of beers</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={beerCount}
                  onChange={(e) => setBeerCount(parseInt(e.target.value, 10) || 13)}
                  className="w-full rounded-lg bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)]"
                />
              </div>
              <div>
                <label className="block text-[var(--text-muted)] text-sm font-medium mb-1">Admin password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="You'll use this to access the admin dashboard"
                  className="w-full rounded-lg bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-3 py-2.5 placeholder-amber-500 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)]"
                />
              </div>
              {error && <p className="text-amber-600 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] disabled:opacity-50 text-[var(--button-text)] font-bold py-3 transition-colors"
              >
                {loading ? "Creating…" : "Create session"}
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-6">
            <p className="text-[var(--text-body)] text-lg">Session created. Share this code with players:</p>
            <div className="rounded-xl bg-[var(--bg-card)] border-2 border-[var(--amber-gold)] p-6 text-center">
              <p className="text-3xl font-bold tracking-[0.3em] text-[var(--amber-gold)] uppercase">
                {createdCode}
              </p>
            </div>
            <button
              type="button"
              onClick={goToAdmin}
              className="w-full rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] text-[var(--button-text)] font-bold py-3 transition-colors"
            >
              Go to admin dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
