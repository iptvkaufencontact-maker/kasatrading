import { cookies, headers } from "next/headers";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import type { Role, SessionUser } from "@/lib/types";

const scrypt = promisify(scryptCallback) as (password: string, salt: string, keylen: number) => Promise<Buffer>;
const SESSION_DAYS = 30;
export const SESSION_COOKIE = "kasa_session";
export const DEFAULT_ADMIN = { name: "Administrateur", email: "admin@kasa.com", password: "12345678" };

/** Login is enabled by default and can only be disabled explicitly. */
export function authRequired() { return process.env.KASA_AUTH_REQUIRED !== "false"; }
/** Identity used when authentication is disabled: full access, no account. */
export const OPEN_USER: SessionUser = { id: 0, name: "Espace commercial", email: "", role: "admin", mustChangePassword: false };

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hex] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  const hash = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Create the default administrator account when it does not exist yet. */
export async function ensureDefaultUser() {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, DEFAULT_ADMIN.email)).limit(1);
  if (existing.length) return;
  await db.insert(users).values({
    name: DEFAULT_ADMIN.name, email: DEFAULT_ADMIN.email, role: "admin", mustChangePassword: false,
    passwordHash: await hashPassword(DEFAULT_ADMIN.password),
  }).onConflictDoNothing();
}

export async function defaultPasswordStillActive() {
  const rows = await db.select({ must: users.mustChangePassword }).from(users).where(eq(users.email, DEFAULT_ADMIN.email)).limit(1);
  return rows[0]?.must === true;
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function destroySession(token: string | undefined | null) {
  if (token && isTokenShape(token)) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

function isTokenShape(token: string) {
  return /^[a-f0-9]{64}$/.test(token);
}

function requestHost(request: Request) {
  return (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(",")[0].trim().toLowerCase();
}

function isLocalHost(host: string) {
  const name = host.replace(/^\[/, "").split(/[\]:]/)[0];
  return name === "localhost" || name === "127.0.0.1" || name === "::1" || name === "0.0.0.0" || name.endsWith(".local")
    || /^10\./.test(name) || /^192\.168\./.test(name) || /^172\.(1[6-9]|2\d|3[01])\./.test(name);
}

/**
 * Behind preview/hosting proxies the forwarded protocol is not always reliable, so any
 * non-local host is treated as HTTPS: the cookie is then Secure and SameSite=None, which
 * keeps the session working when the app is displayed inside an embedded frame.
 */
export function cookiePolicy(request: Request) {
  const forced = process.env.KASA_COOKIE_SECURE;
  const proto = (request.headers.get("x-forwarded-proto") || "").split(",")[0].trim();
  const secure = forced ? forced === "true" : proto === "https" || new URL(request.url).protocol === "https:" || !isLocalHost(requestHost(request));
  return { secure, sameSite: (secure ? "none" : "lax") as "none" | "lax" };
}

/** Reject cross-site mutations: the Origin header must match the host that served the app. */
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host.toLowerCase() === requestHost(request); } catch { return false; }
}

export function sessionCookie(request: Request, token: string, expires: Date) {
  const policy = cookiePolicy(request);
  return { name: SESSION_COOKIE, value: token, httpOnly: true, path: "/", expires, ...policy };
}

export function clearedSessionCookie(request: Request) {
  const policy = cookiePolicy(request);
  return { name: SESSION_COOKIE, value: "", httpOnly: true, path: "/", expires: new Date(0), ...policy };
}

/** Session token from the cookie, or from the Authorization header used by the client fallback. */
export async function requestToken() {
  const store = await cookies();
  const fromCookie = store.get(SESSION_COOKIE)?.value;
  if (fromCookie && isTokenShape(fromCookie)) return fromCookie;
  const authorization = (await headers()).get("authorization") || "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  return bearer && isTokenShape(bearer) ? bearer : null;
}

export async function currentUser(): Promise<SessionUser | null> {
  if (!authRequired()) return OPEN_USER;
  const token = await requestToken();
  if (!token) return null;
  const rows = await db.select({ user: users }).from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const user = rows[0]?.user;
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role as Role, mustChangePassword: user.mustChangePassword };
}
