import type { Request, Response } from "express";

const ACCESS_COOKIE = "afta_sb_access";
const REFRESH_COOKIE = "afta_sb_refresh";
const COOKIE_PATH = "/api";

export type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: SupabaseUser;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be configured.");
  }
  return { url, anonKey };
}

function cookieValue(req: Request, name: string) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return null;
}

function secureCookie(req: Request) {
  return (
    process.env.NODE_ENV === "production" ||
    req.secure ||
    req.headers["x-forwarded-proto"] === "https"
  );
}

async function authRequest<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
  const { url, anonKey } = config();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      typeof payload.msg === "string" ? payload.msg :
      typeof payload.message === "string" ? payload.message :
      typeof payload.error_description === "string" ? payload.error_description :
      "Supabase authentication failed.";
    const error = new Error(message) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = typeof payload.error_code === "string" ? payload.error_code : undefined;
    throw error;
  }
  return payload as T;
}

export function setSupabaseSessionCookies(req: Request, res: Response, session: SupabaseSession) {
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureCookie(req),
    path: COOKIE_PATH,
  };
  res.cookie(ACCESS_COOKIE, session.access_token, {
    ...options,
    maxAge: Math.max(60, session.expires_in) * 1000,
  });
  res.cookie(REFRESH_COOKIE, session.refresh_token, {
    ...options,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearSupabaseSessionCookies(req: Request, res: Response) {
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureCookie(req),
    path: COOKIE_PATH,
  };
  res.clearCookie(ACCESS_COOKIE, options);
  res.clearCookie(REFRESH_COOKIE, options);
}

export async function signUpWithSupabase(email: string, password: string, name: string) {
  return authRequest<SupabaseSession | { user: SupabaseUser; access_token?: null }>("signup", {
    email,
    password,
    data: { name },
  });
}

export async function signInWithSupabase(email: string, password: string) {
  return authRequest<SupabaseSession>("token?grant_type=password", { email, password });
}

export async function signOutFromSupabase(accessToken: string) {
  await authRequest<Record<string, never>>("logout", {}, accessToken);
}

async function getSupabaseUser(accessToken: string) {
  const { url, anonKey } = config();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  return await response.json() as SupabaseUser;
}

export async function getSupabaseRequestAuth(req: Request, res: Response) {
  let accessToken = cookieValue(req, ACCESS_COOKIE);
  let user = accessToken ? await getSupabaseUser(accessToken) : null;
  if (!user) {
    const refreshToken = cookieValue(req, REFRESH_COOKIE);
    if (!refreshToken) return null;
    const refreshed = await authRequest<SupabaseSession>("token?grant_type=refresh_token", {
      refresh_token: refreshToken,
    });
    setSupabaseSessionCookies(req, res, refreshed);
    accessToken = refreshed.access_token;
    user = refreshed.user;
  }
  return { accessToken: accessToken!, user };
}

export async function supabaseRest<T>(
  path: string,
  init: RequestInit,
  accessToken?: string,
): Promise<T> {
  const { url, anonKey } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken ?? anonKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${text.slice(0, 300)}`);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}