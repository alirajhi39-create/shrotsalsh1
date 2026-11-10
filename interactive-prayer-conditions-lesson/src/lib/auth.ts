import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const TEACHER_COOKIE = "shurut_teacher";
export const STUDENT_COOKIE = "shurut_student";
export const STUDENT_SESSION_DAYS = 120;
export const TEACHER_SESSION_SECONDS = 12 * 3600;

/**
 * هل الطلب قادم عبر HTTPS من منظور المتصفح؟
 * نعتمد أولًا على Origin/Referer (يرسلهما المتصفح من عنوان الصفحة الفعلي)،
 * ثم x-forwarded-proto، ثم نفترض HTTPS لأي مضيف غير محلي.
 */
export function requestIsHttps(h: Headers): boolean {
  for (const key of ["origin", "referer"]) {
    const v = h.get(key);
    if (v && v !== "null" && /^https?:\/\//i.test(v)) return v.toLowerCase().startsWith("https://");
  }
  const xf = h.get("x-forwarded-proto");
  if (xf && xf.split(",")[0].trim().toLowerCase() === "https") return true;
  // بروكسي المعاينة قد يمرّر http رغم أن الرابط الفعلي HTTPS،
  // والأصل "null" يظهر في الإطارات المقيّدة (sandbox). نعتمد على اسم المضيف حينها.
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase();
  return host.length > 0 && !/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/.test(host);
}

export type SessionCookieOptions = {
  httpOnly: true;
  path: "/";
  secure: boolean;
  sameSite: "none" | "lax";
  partitioned?: boolean;
  maxAge: number;
};

/**
 * خيارات كوكي الجلسة:
 * عبر HTTPS نستخدم SameSite=None + Secure + Partitioned حتى يعمل الدخول
 * عندما يُعرض الموقع داخل إطار (iframe) مثل نوافذ المعاينة والمنصات التعليمية.
 * محليًا عبر HTTP نستخدم Lax (المتصفحات ترفض None بدون Secure).
 */
export function sessionCookieOptions(h: Headers, maxAgeSeconds: number): SessionCookieOptions {
  const https = requestIsHttps(h);
  return {
    httpOnly: true,
    path: "/",
    secure: https,
    sameSite: https ? "none" : "lax",
    ...(https ? { partitioned: true } : {}),
    maxAge: maxAgeSeconds,
  };
}

export function clearCookieOptions(h: Headers): SessionCookieOptions {
  return { ...sessionCookieOptions(h, 0), maxAge: 0 };
}

/** قراءة رمز حامل (Bearer) من ترويسة Authorization أو x-student-token */
export function readBearerToken(h: Headers): string | null {
  const auth = h.get("authorization");
  if (auth && /^bearer\s+/i.test(auth)) {
    const t = auth.replace(/^bearer\s+/i, "").trim();
    if (t) return t;
  }
  const alt = h.get("x-student-token");
  return alt && alt.trim() ? alt.trim() : null;
}

function secret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  // احتياطي للتشغيل المحلي فقط؛ يُنصح بضبط AUTH_SECRET في بيئة الإنتاج.
  return createHash("sha256")
    .update(`shurut-alsalah::${process.env.DATABASE_URL ?? "local"}`)
    .digest("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSignedToken(data: Record<string, string | number>, ttlSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + ttlSeconds * 1000 })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

export function verifySignedToken<T extends { exp: number }>(token: string | undefined | null): T | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export type TeacherSession = { teacherId: number; username: string };

export async function getTeacherSession(): Promise<TeacherSession | null> {
  const jar = await cookies();
  const data = verifySignedToken<{ tid: number; u: string; exp: number }>(jar.get(TEACHER_COOKIE)?.value);
  return data ? { teacherId: data.tid, username: data.u } : null;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("UNAUTHORIZED");
  }
}

export function verifyTeacherToken(token: string | null | undefined): TeacherSession | null {
  const data = verifySignedToken<{ tid: number; u: string; exp: number }>(token);
  return data ? { teacherId: data.tid, username: data.u } : null;
}

/**
 * جلسة المعلم من طلب HTTP: ترويسة Authorization أولًا (لا تعتمد على الكوكيز)،
 * ثم الكوكي الموقّع كبديل. تُستخدم في كل مسارات API المحمية.
 */
export async function teacherSessionFromRequest(req: Request): Promise<TeacherSession | null> {
  const auth = req.headers.get("authorization");
  if (auth && /^bearer\s+/i.test(auth)) {
    const token = auth.replace(/^bearer\s+/i, "").trim();
    const session = verifyTeacherToken(token);
    if (session) return session;
  }
  const alt = req.headers.get("x-teacher-token");
  const fromAlt = verifyTeacherToken(alt);
  if (fromAlt) return fromAlt;
  return getTeacherSession();
}

export async function requireTeacher(): Promise<TeacherSession> {
  const session = await getTeacherSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateResumeCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** رمز انضمام قصير للمسابقة الجماعية (أرقام فقط لسهولة الإدخال من الجوال) */
export function generateRoomCode(): string {
  const bytes = randomBytes(2);
  const n = (bytes[0] << 8 | bytes[1]) % 10000;
  return String(n).padStart(4, "0");
}

export function generateSerial(): string {
  return `SH-${generateResumeCode(10)}`;
}
