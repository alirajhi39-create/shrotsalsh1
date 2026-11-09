"use client";

/**
 * إدارة رمز جلسة الطالب في المتصفح.
 * الكوكي httpOnly هو الأساس، مع ثلاث طرق احتياطية عند حجبه:
 * التخزين المحلي/الجلسة، واسم النافذة، ثم جزء الرابط (hash) الذي لا يُرسل إلى الخادم.
 */
const KEY = "shurut_student_token";
const WINDOW_NAME_PREFIX = "shurut-student:";
let memoryToken: string | null = null;

export function getStudentToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    const v = window.localStorage.getItem(KEY);
    if (v) {
      memoryToken = v;
      return v;
    }
  } catch {
    /* التخزين غير متاح */
  }
  try {
    const v = window.sessionStorage.getItem(KEY);
    if (v) {
      memoryToken = v;
      return v;
    }
  } catch {
    /* التخزين غير متاح */
  }
  try {
    if (window.name.startsWith(WINDOW_NAME_PREFIX)) {
      const v = window.name.slice(WINDOW_NAME_PREFIX.length);
      if (v) {
        memoryToken = v;
        return v;
      }
    }
  } catch {
    /* تجاهل */
  }
  return null;
}

/** يعيد true إذا أمكن حفظ الرمز في تخزين يبقى بعد إعادة التحميل. */
export function setStudentToken(token: string | null): boolean {
  memoryToken = token;
  let persisted = false;
  try {
    if (token) window.localStorage.setItem(KEY, token);
    else window.localStorage.removeItem(KEY);
    persisted = true;
  } catch {
    /* تجاهل */
  }
  try {
    if (token) window.sessionStorage.setItem(KEY, token);
    else window.sessionStorage.removeItem(KEY);
    persisted = true;
  } catch {
    /* تجاهل */
  }
  try {
    window.name = token ? WINDOW_NAME_PREFIX + token : "";
    persisted = true;
  } catch {
    /* تجاهل */
  }
  return persisted;
}

/** يلتقط رمزًا من #s=...؛ الجزء بعد # لا يظهر في سجلات الخادم أو ترويسة Referer. */
export function captureStudentTokenFromHash(): string | null {
  try {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = params.get("s");
    if (token) {
      setStudentToken(token);
      return token;
    }
  } catch {
    /* تجاهل */
  }
  return getStudentToken();
}

export function studentLessonUrl(token?: string | null, persisted = true): string {
  return token && !persisted ? `/lesson#s=${encodeURIComponent(token)}` : "/lesson";
}

export function clearStudentUrlToken() {
  try {
    if (window.location.hash.includes("s=")) {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
  } catch {
    /* تجاهل */
  }
}

export function studentFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers ?? {});
  const t = getStudentToken();
  if (t && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${t}`);
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}
