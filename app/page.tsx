"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter a session code.");
      return;
    }
    setError(null);
    setLoading(true);
    const supabase = createSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("sessions")
      .select("id, code, is_active")
      .eq("code", trimmed)
      .single();
    if (fetchError || !data) {
      setError("Session not found. Check your code!");
      setLoading(false);
      return;
    }
    if (!data.is_active) {
      setError("Session not found. Check your code!");
      setLoading(false);
      return;
    }
    router.push(`/session/${data.code}`);
    setLoading(false);
  }

  async function handleAdminDashboard(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = adminCode.trim().toUpperCase();
    if (!trimmed || !adminPassword.trim()) {
      setAdminError("Enter code and password.");
      return;
    }
    setAdminError(null);
    setAdminLoading(true);
    const supabase = createSupabaseClient();
    const { data: session, error: fetchError } = await supabase
      .from("sessions")
      .select("id, code, admin_password")
      .eq("code", trimmed)
      .single();
    if (fetchError || !session) {
      setAdminError("Invalid code or password");
      setAdminLoading(false);
      return;
    }
    if (session.admin_password !== adminPassword.trim()) {
      setAdminError("Invalid code or password");
      setAdminLoading(false);
      return;
    }
    const res = await fetch(`/api/session/${session.code}/admin-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: adminPassword.trim() }),
    });
    if (!res.ok) {
      setAdminError("Invalid code or password");
      setAdminLoading(false);
      return;
    }
    if (typeof window !== "undefined") {
      sessionStorage.setItem("admin_password", adminPassword.trim());
    }
    router.push(`/session/${session.code}/admin`);
    setAdminLoading(false);
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-[480px] mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold text-center mb-4 text-[var(--text-heading)]">
          🍺 Blind Beer Tasting
        </h1>
        <img
          src="https://media.giphy.com/media/3oriO04qxVReM5rJEA/giphy.gif"
          alt=""
          className="w-[120px] h-auto mx-auto mb-6 rounded-lg"
        />
        <form onSubmit={handleJoin} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="Enter code e.g. BREW42"
            className="w-full rounded-lg bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-4 py-3 text-lg placeholder-amber-600 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)] focus:border-[var(--amber-gold)] uppercase tracking-wider"
          />
          {error && (
            <p className="text-amber-600 text-center text-sm" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] text-[var(--button-text)] font-bold py-3.5 text-lg transition-colors disabled:opacity-60"
          >
            {loading ? "Checking…" : "Join Tasting"}
          </button>
        </form>
        <p className="text-center mt-8 text-[var(--text-muted)] text-sm">
          <Link href="/create" className="hover:text-[var(--amber-gold)] underline underline-offset-2">
            Host a tasting? Create session →
          </Link>
        </p>

        <section className="mt-12 pt-8 border-t border-[var(--border-subtle)]">
          <h2 className="text-lg font-bold text-[var(--text-heading)] mb-3">Admin? Rejoin your dashboard</h2>
          <form onSubmit={handleAdminDashboard} className="space-y-3">
            <input
              type="text"
              value={adminCode}
              onChange={(e) => {
                setAdminCode(e.target.value.toUpperCase());
                setAdminError(null);
              }}
              placeholder="Session code"
              className="w-full rounded-lg bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-3 py-2 text-sm placeholder-amber-500 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)] uppercase tracking-wider"
            />
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => {
                setAdminPassword(e.target.value);
                setAdminError(null);
              }}
              placeholder="Admin password"
              className="w-full rounded-lg bg-white border-2 border-[var(--border-amber)] text-[var(--text-heading)] px-3 py-2 text-sm placeholder-amber-500 focus:outline-none focus:ring-2 focus:ring-[var(--amber-gold)]"
            />
            {adminError && (
              <p className="text-amber-600 text-sm" role="alert">{adminError}</p>
            )}
            <button
              type="submit"
              disabled={adminLoading}
              className="w-full rounded-xl bg-[var(--amber-gold)] hover:bg-[var(--amber-gold-hover)] disabled:opacity-50 text-[var(--button-text)] font-bold py-2.5 text-sm transition-colors"
            >
              {adminLoading ? "Checking…" : "Go to Dashboard →"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
