import { NextRequest, NextResponse } from "next/server";
import { getSessionByCode, createAdminToken, setAdminCookie } from "@/lib/admin-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const session = await getSessionByCode(code);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.admin_password !== (body.password ?? "")) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const token = createAdminToken(code);
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", setAdminCookie(token));
  return res;
}
