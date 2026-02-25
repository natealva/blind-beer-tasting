import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-amber-950/30 text-amber-100">
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-amber-200 mb-2">
          Blind Beer Tasting
        </h1>
        <p className="text-amber-200/80 mb-12">
          Create a session or join one with a code.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/create"
            className="rounded-xl bg-amber-600 hover:bg-amber-500 text-amber-950 font-semibold px-6 py-3 transition-colors"
          >
            Create a tasting
          </Link>
          <Link
            href="/join"
            className="rounded-xl border-2 border-amber-600/60 hover:border-amber-500 hover:bg-amber-900/40 text-amber-200 font-semibold px-6 py-3 transition-colors"
          >
            Join with code
          </Link>
        </div>
      </div>
    </div>
  );
}
