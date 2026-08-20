import crypto from "node:crypto";
import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { User } from "../drizzle/schema";
import * as db from "./db";
import { ENV } from "./_core/env";
import { getSessionCookieOptions } from "./_core/cookies";

const LOCAL_OPEN_ID = "local-admin";
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; lockedUntil: number }>();

type LocalSession = { openId: string; role: "admin" | "user"; name: string };

function getPin(): string {
  const pin = process.env.LOCAL_AUTH_PIN?.trim() ?? "";
  if (!/^\d{4,12}$/.test(pin)) throw new Error("LOCAL_AUTH_PIN must contain 4 to 12 digits");
  return pin;
}

function hashPin(pin: string, salt = crypto.randomBytes(16).toString("hex")) {
  const digest = crypto.scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${digest}`;
}

function verifyHash(pin: string, stored: string) {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest || !/^[a-f0-9]{64}$/i.test(digest)) return false;
  const candidate = crypto.scryptSync(pin, salt, 32);
  const expected = Buffer.from(digest, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function storedPinHash() {
  const configuredHash = process.env.LOCAL_AUTH_PIN_HASH?.trim();
  return configuredHash || hashPin(getPin(), "venture-os-local-pin");
}

function clientKey(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function canAttempt(req: Request) {
  const state = attempts.get(clientKey(req));
  return !state || state.lockedUntil <= Date.now();
}

function recordFailure(req: Request) {
  const key = clientKey(req);
  const current = attempts.get(key) ?? { count: 0, lockedUntil: 0 };
  current.count += 1;
  if (current.count >= PIN_MAX_ATTEMPTS) {
    current.count = 0;
    current.lockedUntil = Date.now() + PIN_LOCK_MS;
  }
  attempts.set(key, current);
}

function clearFailures(req: Request) {
  attempts.delete(clientKey(req));
}

async function ensureLocalUser(): Promise<User> {
  let user = await db.getUserByOpenId(LOCAL_OPEN_ID);
  if (!user) {
    await db.upsertUser({ openId: LOCAL_OPEN_ID, name: "Venture OS Admin", email: null, loginMethod: "local-pin", role: "admin" });
    user = await db.getUserByOpenId(LOCAL_OPEN_ID);
  }
  if (!user) throw new Error("Unable to initialize local admin user");
  return user;
}

async function signSession(user: User) {
  const secret = ENV.cookieSecret;
  if (!secret) throw new Error("JWT_SECRET is required for local authentication");
  return new SignJWT({ openId: user.openId, role: user.role, name: user.name ?? "Venture OS Admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000))
    .sign(new TextEncoder().encode(secret));
}

export async function loginWithPin(req: Request, res: Response, pin: string) {
  if (!canAttempt(req)) return { ok: false as const, locked: true as const };
  if (!verifyHash(pin, storedPinHash())) {
    recordFailure(req);
    return { ok: false as const, locked: false as const };
  }
  const user = await ensureLocalUser();
  clearFailures(req);
  const token = await signSession(user);
  res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
  return { ok: true as const, user };
}

export async function authenticateLocalRequest(req: Request): Promise<User | null> {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!token || !ENV.cookieSecret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(ENV.cookieSecret), { algorithms: ["HS256"] });
    if (payload.openId !== LOCAL_OPEN_ID) return null;
    return (await db.getUserByOpenId(LOCAL_OPEN_ID)) ?? null;
  } catch {
    return null;
  }
}

export function logoutLocal(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(req), maxAge: -1 });
}
