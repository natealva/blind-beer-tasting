import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const COOKIE_NAME = "blind_beer_admin";
const MAX_AGE = 60 * 60 * 24; // 24 hours

function getSecret(): string {
  const s = process.env.BLIND_BEER_ADMIN_SECRET;
  if (!s) return "dev-secret-change-in-production";
  return s;
}

function sign(payload: string): string {
  const secret = getSecret();
  const b64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return b64 + "." + sig;
}

function verifyToken(token: string): { code: string } | null {
  const secret = getSecret();
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  try {
    const payload = Buffer.from(payloadB64, "base64url").toString("utf8");
    const parsed = JSON.parse(payload) as { code: string; exp: number };
    if (parsed.exp < Date.now() / 1000) return null;
    const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
    if (sig !== expectedSig) return null;
    return { code: parsed.code };
  } catch {
    return null;
  }
}

export function createAdminToken(code: string): string {
  const payload = JSON.stringify({ code, exp: Math.floor(Date.now() / 1000) + MAX_AGE });
  return sign(payload);
}

export function verifyAdminToken(token: string): { code: string } | null {
  return verifyToken(token);
}

export async function getAdminCodeFromCookie(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const result = verifyAdminToken(token);
  return result?.code ?? null;
}

export function setAdminCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax`;
}

export function clearAdminCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

export async function verifySessionAdmin(sessionCode: string): Promise<boolean> {
  const adminCode = await getAdminCodeFromCookie();
  return adminCode === sessionCode;
}

export async function getSessionByCode(code: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("code", code)
    .single();
  if (error || !data) return null;
  return data;
}
