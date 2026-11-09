"use client";

import { useState } from "react";
import { setTeacherFallback, setTeacherToken } from "@/lib/teacher-client-auth";

export default function TeacherLoginForm({ fallbackAction }: { fallbackAction: (fd: FormData) => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    try {
      const res = await fetch("/api/teacher/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setError(data.error ?? "تعذر تسجيل الدخول");
        return;
      }
      setTeacherToken(data.token);

      // نتحقق فعليًا من أن المتصفح قبل الكوكي. إن حجبه نستخدم الرمز الموقّع في الرابط
      // (مسار احتياطي يعمل أيضًا مع Server Actions وإعادة تحميل الصفحة).
      let cookieAccepted = false;
      try {
        const check = await fetch("/api/teacher/session", { cache: "no-store", credentials: "same-origin" });
        cookieAccepted = check.ok;
      } catch {
        cookieAccepted = false;
      }
      setTeacherFallback(!cookieAccepted);
      window.location.assign(cookieAccepted ? "/teacher" : `/teacher?auth=${encodeURIComponent(data.token)}`);
    } catch {
      setError("تعذر الاتصال بالخادم. تحقق من الشبكة ثم حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form action={fallbackAction} onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block font-bold text-slate-700">كلمة مرور المعلم</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          disabled={busy}
          className="w-full rounded-2xl border-2 border-slate-200 p-3 text-center text-2xl tracking-widest focus:border-turq-400 focus:outline-none disabled:bg-slate-50"
        />
      </label>
      {error && (
        <p role="alert" className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="w-full rounded-2xl bg-turq-600 py-3 text-lg font-black text-white shadow-lg hover:bg-turq-700 disabled:opacity-60"
      >
        {busy ? "جارٍ التحقق…" : "دخول"}
      </button>
    </form>
  );
}
