import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authRequired, clearedSessionCookie, createSession, currentUser, destroySession, ensureDefaultUser, hashPassword, requestToken, sameOrigin, sessionCookie, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 6;
const WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number }>();

function attemptKey(request: Request, email: string) {
  return `${(request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local"}|${email}`;
}
function isBlocked(key: string) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > WINDOW_MS) { attempts.delete(key); return false; }
  return entry.count >= MAX_ATTEMPTS;
}
function registerFailure(key: string) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.firstAt > WINDOW_MS) attempts.set(key, { count: 1, firstAt: Date.now() });
  else entry.count += 1;
  if (attempts.size > 5000) attempts.clear();
}

/** Session check used by the client when cookies are unavailable (embedded frames, strict browsers). */
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
    return NextResponse.json({ user });
  } catch (error) {
    console.error("Session check failed", error);
    return NextResponse.json({ error: "Vérification impossible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
    if (!authRequired()) return NextResponse.json({ ok: true });
    const body = await request.json().catch(() => null);
    const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(160), password: z.string().min(1).max(200) }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Veuillez saisir une adresse e-mail et un mot de passe valides." }, { status: 400 });
    const { email, password } = parsed.data;
    const key = attemptKey(request, email);
    if (isBlocked(key)) return NextResponse.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429 });

    await ensureDefaultUser();
    const [account] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const valid = account ? await verifyPassword(password, account.passwordHash) : (await hashPassword(password), false);
    if (!account || !valid) {
      registerFailure(key);
      return NextResponse.json({ error: "E-mail ou mot de passe incorrect." }, { status: 401 });
    }
    attempts.delete(key);
    const { token, expiresAt } = await createSession(account.id);
    const response = NextResponse.json({ ok: true, token });
    response.cookies.set(sessionCookie(request, token, expiresAt));
    return response;
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json({ error: "Connexion impossible. Veuillez réessayer." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
  await destroySession(await requestToken());
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearedSessionCookie(request));
  return response;
}
