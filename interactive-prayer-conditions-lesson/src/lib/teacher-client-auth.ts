"use client";

const KEY = "shurut_teacher_token";
const FALLBACK_KEY = "shurut_teacher_fallback";
let memoryToken: string | null = null;
let memoryFallback = false;

export function setTeacherToken(token: string | null): boolean {
  memoryToken = token;
  let stored = false;
  for (const storage of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const s = storage();
      if (token) s.setItem(KEY, token);
      else s.removeItem(KEY);
      stored = true;
    } catch {
      /* التخزين غير متاح */
    }
  }
  return stored;
}

export function getTeacherToken(): string | null {
  if (memoryToken) return memoryToken;
  for (const storage of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const v = storage().getItem(KEY);
      if (v) {
        memoryToken = v;
        return v;
      }
    } catch {
      /* تجاهل */
    }
  }
  return null;
}

export function setTeacherFallback(active: boolean) {
  memoryFallback = active;
  try {
    if (active) window.sessionStorage.setItem(FALLBACK_KEY, "1");
    else window.sessionStorage.removeItem(FALLBACK_KEY);
  } catch {
    /* يبقى العلم في الذاكرة */
  }
}

export function isTeacherFallback(): boolean {
  if (memoryFallback) return true;
  try {
    if (new URL(window.location.href).searchParams.has("auth")) return true;
  } catch {
    /* تجاهل */
  }
  try {
    return window.sessionStorage.getItem(FALLBACK_KEY) === "1";
  } catch {
    return false;
  }
}

/** يلتقط الرمز الاحتياطي من الرابط الحالي (عندما تكون الكوكيز محجوبة). */
export function captureTeacherTokenFromUrl(): string | null {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("auth");
    if (token) {
      setTeacherToken(token);
      setTeacherFallback(true);
      return token;
    }
  } catch {
    /* تجاهل */
  }
  return getTeacherToken();
}
