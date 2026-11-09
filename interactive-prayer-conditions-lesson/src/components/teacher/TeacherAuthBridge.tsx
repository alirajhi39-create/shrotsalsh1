"use client";

import { useEffect } from "react";
import {
  captureTeacherTokenFromUrl,
  getTeacherToken,
  isTeacherFallback,
  setTeacherFallback,
  setTeacherToken,
} from "@/lib/teacher-client-auth";

/**
 * جسر الجلسة الاحتياطي للمعلم. الكوكي httpOnly هو الأساس؛ ولا يظهر معامل auth
 * في الرابط إلا إذا أثبت فحص الجلسة أن المتصفح لم يقبل الكوكي.
 */
export default function TeacherAuthBridge() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const originalPush = window.history.pushState.bind(window.history);
    const originalReplace = window.history.replaceState.bind(window.history);
    let disposed = false;

    const withAuth = (input: string | URL): string | URL => {
      try {
        const url = new URL(input.toString(), window.location.href);
        const token = getTeacherToken();
        const teacherPath = url.pathname.startsWith("/teacher") || url.pathname.startsWith("/api/teacher");
        if (
          token &&
          isTeacherFallback() &&
          url.origin === window.location.origin &&
          teacherPath &&
          url.pathname !== "/teacher/login"
        ) {
          url.searchParams.set("auth", token);
        }
        return typeof input === "string" ? url.toString() : url;
      } catch {
        return input;
      }
    };

    const token = captureTeacherTokenFromUrl();

    // فحص حقيقي للكوكي قبل تفعيل ظهور الرمز في الرابط
    if (token && !new URL(window.location.href).searchParams.has("auth")) {
      void originalFetch("/api/teacher/session", { cache: "no-store", credentials: "same-origin" })
        .then((res) => {
          if (!res.ok && !disposed) {
            setTeacherFallback(true);
            originalReplace(window.history.state, "", withAuth(window.location.href));
          }
        })
        .catch(() => {
          /* لا نغيّر المسار عند خطأ شبكة عابر */
        });
    }

    if (token && isTeacherFallback()) {
      originalReplace(window.history.state, "", withAuth(window.location.href));
    }

    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const url = new URL(raw, window.location.href);
        const active = getTeacherToken();
        const isTeacherRequest =
          url.origin === window.location.origin &&
          (url.pathname.startsWith("/teacher") || url.pathname.startsWith("/api/teacher"));
        if (active && isTeacherRequest) {
          const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
          if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${active}`);
          return originalFetch(input, { ...init, headers, credentials: "same-origin" });
        }
      } catch {
        /* استخدم الطلب الأصلي */
      }
      return originalFetch(input, init);
    }) as typeof window.fetch;

    window.history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
      return originalPush(data, unused, url ? withAuth(url) : url);
    }) as typeof window.history.pushState;
    window.history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
      return originalReplace(data, unused, url ? withAuth(url) : url);
    }) as typeof window.history.replaceState;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (anchor) anchor.href = withAuth(anchor.href).toString();
    };
    const onSubmit = (event: SubmitEvent) => {
      if ((event.target as HTMLFormElement | null)?.id === "teacher-logout-form") {
        setTeacherToken(null);
        setTeacherFallback(false);
      }
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);

    return () => {
      disposed = true;
      window.fetch = originalFetch;
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return null;
}
