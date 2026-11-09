"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearStudentUrlToken, getStudentToken, setStudentToken, studentFetch, studentLessonUrl } from "@/lib/client-auth";
import { Btn, cx } from "./lesson/ui";
import IframeHint from "./IframeHint";

type Classroom = { id: number; name: string };
type Current = { id: number; name: string; classroom: string } | null;

export default function StudentEntry({ classrooms, current: serverCurrent }: { classrooms: Classroom[]; current: Current }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Current>(serverCurrent);
  const [name, setName] = useState("");
  const [classroomId, setClassroomId] = useState<number>(classrooms[0]?.id ?? 0);
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [welcome, setWelcome] = useState<{ name: string; resumeCode: string } | null>(null);
  const [destination, setDestination] = useState("/lesson");

  // إن لم يتعرف الخادم على الكوكي، نتحقق من الرمز الاحتياطي المحفوظ في المتصفح
  useEffect(() => {
    if (serverCurrent || !getStudentToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await studentFetch("/api/student/session", { cache: "no-store" });
        const data = (await res.json()) as { student: Current };
        if (!cancelled) {
          if (data.student) setCurrent(data.student);
          else setStudentToken(null);
        }
      } catch {
        /* تجاهل */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serverCurrent]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await studentFetch("/api/student/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, classroomId, resumeCode: code || undefined }),
      });
      const data = (await res.json()) as {
        error?: string;
        requiresCode?: boolean;
        isNew?: boolean;
        token?: string;
        student?: { name: string; resumeCode: string };
      };
      if (!res.ok) {
        if (data.requiresCode) setNeedCode(true);
        setError(data.error ?? "تعذر بدء الجلسة");
        return;
      }
      let target = "/lesson";
      if (data.token) {
        const persisted = setStudentToken(data.token);
        target = studentLessonUrl(data.token, persisted);
        setDestination(target);
      }
      if (data.isNew && data.student) {
        setWelcome({ name: data.student.name, resumeCode: data.student.resumeCode });
      } else {
        router.push(target);
      }
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await studentFetch("/api/student/session", { method: "DELETE" });
    setStudentToken(null);
    clearStudentUrlToken();
    setCurrent(null);
    router.refresh();
  };

  if (welcome) {
    return (
      <div className="animate-pop rounded-3xl bg-white p-6 text-center shadow-2xl shadow-turq-900/10">
        <div className="text-6xl">🎉</div>
        <h2 className="mt-2 text-2xl font-black text-turq-900">أهلًا بك يا {welcome.name}!</h2>
        <p className="mt-2 text-slate-600">هذا رمز الاستكمال الخاص بك. احفظه أو صوّره لتتابع درسك من أي جهاز:</p>
        <div className="mx-auto my-4 w-fit rounded-2xl border-4 border-dashed border-brand-orange bg-orange-50 px-8 py-3 font-mono text-4xl font-black tracking-[0.3em] text-orange-700">
          {welcome.resumeCode}
        </div>
        <p className="text-xs text-slate-500">يمكن لمعلمك أيضًا الاطلاع على الرمز إذا نسيته.</p>
        <Btn size="lg" className="mt-5 w-full" onClick={() => router.push(destination)}>
          ابدأ الدرس 🚀
        </Btn>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-2xl shadow-turq-900/10">
      <IframeHint compact />
      {current && (
        <div className="mb-5 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
          <p className="font-bold text-emerald-900">
            مرحبًا بعودتك يا {current.name} ({current.classroom})
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn variant="success" onClick={() => router.push("/lesson")}>
              ▶️ متابعة تقدمي السابق
            </Btn>
            <Btn variant="ghost" size="sm" onClick={logout}>
              لستُ {current.name}؟ تسجيل الخروج
            </Btn>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-xl font-black text-turq-900">{current ? "أو ابدأ باسم آخر" : "ابدأ رحلتك التعليمية"}</h2>
        <label className="block">
          <span className="mb-1 block font-bold text-slate-700">اسم الطالب</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={40}
            placeholder="اكتب اسمك الثلاثي"
            className="w-full rounded-2xl border-2 border-slate-200 p-4 text-lg focus:border-turq-400 focus:outline-none"
          />
        </label>
        <div>
          <span className="mb-1 block font-bold text-slate-700">الفصل</span>
          <div className="grid grid-cols-2 gap-2">
            {classrooms.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setClassroomId(c.id)}
                className={cx(
                  "touch-target rounded-2xl border-2 p-3 text-lg font-bold transition-all",
                  classroomId === c.id ? "border-turq-500 bg-turq-500 text-white shadow" : "border-slate-200 bg-white hover:border-turq-300",
                )}
              >
                🏫 {c.name}
              </button>
            ))}
          </div>
          {classrooms.length === 0 && <p className="text-sm text-rose-600">لا توجد فصول مفعلة؛ تواصل مع المعلم.</p>}
        </div>
        {needCode && (
          <label className="block animate-fadeup">
            <span className="mb-1 block font-bold text-orange-700">رمز الاستكمال (6 رموز)</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={12}
              placeholder="مثال: A7K2PM"
              className="w-full rounded-2xl border-2 border-orange-300 p-4 text-center font-mono text-2xl tracking-widest focus:border-orange-500 focus:outline-none"
            />
          </label>
        )}
        {error && <p className="rounded-2xl bg-rose-50 p-3 font-bold text-rose-700">{error}</p>}
        <Btn type="submit" size="lg" className="w-full" disabled={busy || !classroomId}>
          {busy ? "لحظة…" : needCode ? "استكمال الدرس 🔓" : "بدء الدرس 🚀"}
        </Btn>
      </form>
    </div>
  );
}
