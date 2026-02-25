import { getSessionByCode, verifySessionAdmin } from "@/lib/admin-auth";
import SessionAdminClient from "./SessionAdminClient";
import AdminLoginForm from "./AdminLoginForm";

export default async function SessionAdminPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await getSessionByCode(code);
  if (!session) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)] flex items-center justify-center">
        <p className="text-red-600">Session not found.</p>
      </div>
    );
  }
  const isAdmin = await verifySessionAdmin(code);
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)]">
        <div className="max-w-md mx-auto px-6 py-12">
          <h1 className="text-xl font-bold text-[var(--text-heading)] mb-4">Admin: {session.name}</h1>
          <AdminLoginForm code={code} />
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-body)]">
      <SessionAdminClient
        code={code}
        sessionId={session.id}
        sessionName={session.name}
        beerCount={session.beer_count}
      />
    </div>
  );
}
