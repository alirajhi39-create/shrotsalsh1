"use client";

/**
 * مصادقة مستقلة تمامًا عن الكوكيز:
 *  - الرمز يُحفظ في الذاكرة،ثم في localStorage إن كان متاحًا،
 *  - ويُحفظ أيضًا في جزء الرابط (#s= / #t=) الذي لا يُرسل للخادم، فيبقى بعد تحديث الصفحة
 *    حتى في الإطارات (iframes) التي تحجب الكوكيز والتخزين المحلي.
 *  - يُرسل مع كل طلب في ترويسة Authorization.
 */

type Credential = "student" | "teacher" | "play";

const STORAGE: Record<Credential, string> = {
  student: "shurut_student_token",
  teacher: "shurut_teacher_token",
  play: "shurut_play_token",
};
const HASH: Record<Credential, string> = { student: "s", teacher: "t", play: "p" };

/**
 * مهم: قد تُضمّن أداة البناء هذه الوحدة في أكثر من حزمة (chunk) عند الانتقال بين
 * المسارات، فتختلف «ذاكرة الوحدة». لذلك نخزّن الرموز على كائن عام في window
 * تشترك فيه كل الحزم، إضافة إلى localStorage وجزء الرابط.
 */
type SharedTokens = { student: string | null; teacher: string | null; play: string | null };
const globalWindow = typeof window !== "undefined" ? (window as Window & { __shurutTokens?: SharedTokens }) : null;
if (globalWindow && !globalWindow.__shurutTokens) {
  globalWindow.__shurutTokens = { student: null, teacher: null, play: null };
}
const memory: SharedTokens = globalWindow?.__shurutTokens ?? { student: null, teacher: null, play: null };

function readHash(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  const raw = window.location.hash.replace(/^#/, "");
  return new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
}

function writeHash(params: URLSearchParams) {
  if (typeof window === "undefined") return;
  const s = params.toString();
  try {
    const next = `${window.location.pathname}${window.location.search}${s ? `#${s}` : ""}`;
    window.history.replaceState(window.history.state, "", next);
  } catch {
    // بعض الإطارات المقيّدة تمنع replaceState؛ تغيير الجزء وحده لا يعيد تحميل الصفحة.
    try { window.location.hash = s; } catch { /* تبقى الذاكرة وsessionStorage */ }
  }
}

export function getToken(kind: Credential): string | null {
  if (typeof window === "undefined") return null;
  if (memory[kind]) return memory[kind];
  let t: string | null = null;
  try { t = window.localStorage.getItem(STORAGE[kind]); } catch { /* محجوب */ }
  if (!t) { try { t = window.sessionStorage.getItem(STORAGE[kind]); } catch { /* محجوب */ } }
  if (!t) t = readHash().get(HASH[kind]);
  if (t) memory[kind] = t;
  return t;
}

export function setToken(kind: Credential, token: string | null) {
  memory[kind] = token;
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(STORAGE[kind], token);
    else window.localStorage.removeItem(STORAGE[kind]);
  } catch { /* محجوب */ }
  try {
    if (token) window.sessionStorage.setItem(STORAGE[kind], token);
    else window.sessionStorage.removeItem(STORAGE[kind]);
  } catch { /* محجوب */ }
  try {
    const params = readHash();
    if (token) params.set(HASH[kind], token);
    else params.delete(HASH[kind]);
    writeHash(params);
  } catch {
    /* محجوب */
  }
}

/** يبني رابطًا يحتفظ بالرموز عند الانتقال الكامل للصفحة */
export function withTokens(path: string): string {
  if (typeof window === "undefined") return path;
  const params = readHash();
  const s = params.toString();
  return s ? `${path}#${s}` : path;
}

export function authHeaders(kind: Credential): Record<string, string> {
  const t = getToken(kind);
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function authFetch(kind: Credential, input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  const t = getToken(kind);
  if (t && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${t}`);
  return fetch(input, { ...init, headers, cache: init.cache ?? "no-store" });
}

/* ---- اختصارات متوافقة مع الاستخدام السابق ---- */
export const getStudentToken = () => getToken("student");
export const setStudentToken = (t: string | null) => setToken("student", t);
export const studentAuthHeaders = () => authHeaders("student");
export const studentFetch = (input: string, init: RequestInit = {}) => authFetch("student", input, init);
export const teacherFetch = (input: string, init: RequestInit = {}) => authFetch("teacher", input, init);
export const playFetch = (input: string, init: RequestInit = {}) => authFetch("play", input, init);

export async function teacherJson<T = Record<string, unknown>>(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await authFetch("teacher", url, init);
  let data = {} as T;
  try {
    data = (await res.json()) as T;
  } catch {
    /* استجابة غير JSON */
  }
  return { ok: res.ok, status: res.status, data };
}
