"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ActivityResult } from "@/lib/content";
import { ACTIVITIES, SLIDES } from "@/lib/content";
import type { AttemptView, StudentState } from "@/lib/student";
import { setStudentToken, studentFetch } from "@/lib/client-auth";
import { Btn, Confetti, cx, newKey, useSounds, useSpeech } from "./ui";
import { StationIntro, StationDiscover, StationThree, StationTahara } from "./StationsA";
import { StationNajasa, StationDetective, StationAwrah, StationAyah } from "./StationsB";
import { StationClassify, StationBook, StationQuiz, StationChampion } from "./StationsC";

export type JourneyCtx = {
  state: StudentState;
  saveAnswer: (activityKey: string, answer: unknown) => Promise<ActivityResult | null>;
  saveQuestion: (questionId: number, response: unknown) => Promise<{ result: ActivityResult; explanation: string } | null>;
  submitQuiz: (answers: Record<string, unknown>) => Promise<AttemptView | null>;
  uploadAudio: (
    slideKey: string,
    activityKey: string | undefined,
    data: { dataBase64: string; mimeType: string; durationMs: number },
  ) => Promise<boolean>;
  issueCertificate: () => Promise<{ serial: string } | null>;
  speak: (text: string) => void;
  sounds: ReturnType<typeof useSounds>;
  busy: boolean;
  celebrate: () => void;
  goNext: () => void;
};

type Toast = { id: number; text: string; kind: "ok" | "err" | "badge" };

function isStationDone(state: StudentState, key: string): boolean {
  const required = Object.entries(ACTIVITIES)
    .filter(([, a]) => a.slideKey === key && a.required)
    .map(([k]) => k);
  if (required.some((k) => !state.answers[k])) return false;
  if (key === "book") {
    const qs = state.questions.filter((q) => q.slideKey === "book");
    if (qs.some((q) => !state.answers[`q_${q.id}`])) return false;
  }
  if (key === "quiz" && state.attempts.length === 0) return false;
  return true;
}

export default function Journey({ onUnauthorized }: { onUnauthorized?: () => void } = {}) {
  const router = useRouter();
  const [state, setState] = useState<StudentState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confetti, setConfetti] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const sounds = useSounds(soundOn);
  const { speak } = useSpeech();
  const initialised = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  /** التمرير لأعلى الشريحة داخل حاوية الدرس الفعلية (وليس النافذة فقط). */
  const scrollLessonTop = useCallback(() => {
    const behavior: ScrollBehavior = document.documentElement.classList.contains("reduce-motion") ? "auto" : "smooth";
    const scroller = rootRef.current?.closest("[data-lesson-scroll]") as HTMLElement | null;
    if (scroller) scroller.scrollTo({ top: 0, behavior });
    else window.scrollTo({ top: 0, behavior });
    document.scrollingElement?.scrollTo({ top: 0, behavior });
  }, []);

  /** عند فقدان الجلسة: نعود لشاشة الدخول في نفس الصفحة إن أمكن */
  const handleUnauthorized = useCallback(() => {
    setStudentToken(null);
    if (onUnauthorized) onUnauthorized();
    else router.replace("/");
  }, [onUnauthorized, router]);

  const pushToast = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const celebrate = useCallback(() => {
    setConfetti(true);
    sounds.fanfare();
    setTimeout(() => setConfetti(false), 3500);
  }, [sounds]);

  /* تحميل الحالة */
  useEffect(() => {
    (async () => {
      try {
        const res = await studentFetch("/api/student/state", { cache: "no-store" });
        if (res.status === 401) {
          handleUnauthorized();
          return;
        }
        const data = (await res.json()) as { state: StudentState };
        setState(data.state);
        if (!initialised.current) {
          initialised.current = true;
          setCurrent(Math.min(Math.max(data.state.progress.currentSlide, 0), SLIDES.length - 1));
          setSoundOn(data.state.settings.soundsEnabled);
        }
      } catch {
        setError("تعذر تحميل بيانات الدرس. تحقق من الاتصال ثم أعد المحاولة.");
      }
    })();
  }, [router, handleUnauthorized]);

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  const post = useCallback(
    async (url: string, body: unknown) => {
      setBusy(true);
      try {
        const res = await studentFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          handleUnauthorized();
          return null;
        }
        const data = (await res.json()) as Record<string, unknown> & { state?: StudentState; error?: string };
        if (!res.ok) {
          pushToast(data.error ?? "حدث خطأ أثناء الحفظ", "err");
          return null;
        }
        if (data.state) setState(data.state);
        return data;
      } catch {
        pushToast("انقطع الاتصال، لم يتم الحفظ. حاول مرة أخرى.", "err");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [handleUnauthorized, pushToast],
  );

  const saveProgress = useCallback(
    async (slideIndex: number, completeSlide?: string) => {
      await post("/api/student/save", { type: "progress", currentSlide: slideIndex, completeSlide });
    },
    [post],
  );

  const saveAnswer = useCallback<JourneyCtx["saveAnswer"]>(
    async (activityKey, answer) => {
      const data = await post("/api/student/save", { type: "answer", activityKey, answer, idempotencyKey: newKey() });
      if (!data) return null;
      const badges = (data.newAchievements as { title: string; icon: string }[] | undefined) ?? [];
      for (const b of badges) {
        pushToast(`${b.icon} حصلت على وسام: ${b.title}`, "badge");
      }
      if (badges.length) celebrate();
      return data.result as ActivityResult;
    },
    [post, pushToast, celebrate],
  );

  const saveQuestion = useCallback<JourneyCtx["saveQuestion"]>(
    async (questionId, response) => {
      const data = await post("/api/student/save", { type: "question", questionId, response, idempotencyKey: newKey() });
      if (!data) return null;
      return { result: data.result as ActivityResult, explanation: String(data.explanation ?? "") };
    },
    [post],
  );

  const submitQuiz = useCallback<JourneyCtx["submitQuiz"]>(
    async (answers) => {
      const data = await post("/api/student/quiz", { answers, idempotencyKey: newKey() });
      if (!data) return null;
      return (data.attempt as AttemptView) ?? null;
    },
    [post],
  );

  const uploadAudio = useCallback<JourneyCtx["uploadAudio"]>(
    async (slideKey, activityKey, data) => {
      const res = await post("/api/student/save", { type: "audio", slideKey, activityKey, ...data, idempotencyKey: newKey() });
      if (res) pushToast("تم حفظ تسجيلك الصوتي 🎙️");
      return !!res;
    },
    [post, pushToast],
  );

  const issueCertificate = useCallback<JourneyCtx["issueCertificate"]>(async () => {
    const data = await post("/api/student/certificate", {});
    if (!data) return null;
    return (data.certificate as { serial: string }) ?? null;
  }, [post]);

  const currentKey = SLIDES[current].key;
  useEffect(() => {
    const frame = requestAnimationFrame(scrollLessonTop);
    return () => cancelAnimationFrame(frame);
  }, [currentKey, scrollLessonTop]);
  const done = state ? isStationDone(state, currentKey) : false;
  const completed = useMemo(() => new Set(state?.progress.completedSlides ?? []), [state]);
  const firstIncomplete = useMemo(() => {
    if (!state) return 0;
    const idx = SLIDES.findIndex((s) => !isStationDone(state, s.key));
    return idx === -1 ? SLIDES.length - 1 : idx;
  }, [state]);

  /* تسجيل اكتمال المحطة تلقائيًا عند استيفاء أنشطتها */
  const completingRef = useRef<string | null>(null);
  useEffect(() => {
    if (!state || !done || completed.has(currentKey) || completingRef.current === currentKey) return;
    completingRef.current = currentKey;
    saveProgress(current, currentKey).finally(() => {
      completingRef.current = null;
    });
  }, [state, done, completed, currentKey, current, saveProgress]);

  const goTo = useCallback(
    (idx: number) => {
      setCurrent(idx);
      setNavOpen(false);
      requestAnimationFrame(scrollLessonTop);
      saveProgress(idx, done && !completed.has(currentKey) ? currentKey : undefined);
    },
    [saveProgress, done, completed, currentKey, scrollLessonTop],
  );

  const goNext = useCallback(() => {
    if (current < SLIDES.length - 1) goTo(current + 1);
  }, [current, goTo]);

  const exit = async () => {
    await studentFetch("/api/student/session", { method: "DELETE" });
    setStudentToken(null);
    if (onUnauthorized) onUnauthorized();
    else router.push("/");
  };

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
          <p className="text-xl font-bold text-rose-700">{error}</p>
          <Btn className="mt-4" onClick={() => location.reload()}>
            إعادة المحاولة
          </Btn>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-8 border-turq-200 border-t-turq-600" />
          <p className="text-xl font-bold text-turq-800">جارٍ تجهيز رحلتك التعليمية…</p>
        </div>
      </main>
    );
  }

  const ctx: JourneyCtx = {
    state,
    saveAnswer,
    saveQuestion,
    submitQuiz,
    uploadAudio,
    issueCertificate,
    speak,
    sounds,
    busy,
    celebrate,
    goNext,
  };

  const slideMeta = state.slides.find((s) => s.key === currentKey);
  const stationProps = { ctx, title: slideMeta?.title ?? SLIDES[current].title, subtitle: slideMeta?.subtitle ?? SLIDES[current].subtitle };

  const stations: Record<string, React.ReactNode> = {
    intro: <StationIntro {...stationProps} />,
    discover: <StationDiscover {...stationProps} />,
    three: <StationThree {...stationProps} />,
    tahara: <StationTahara {...stationProps} videoUrl={slideMeta?.videoUrl || state.settings.videoUrl} />,
    najasa: <StationNajasa {...stationProps} />,
    detective: <StationDetective {...stationProps} />,
    awrah: <StationAwrah {...stationProps} />,
    ayah: <StationAyah {...stationProps} />,
    classify: <StationClassify {...stationProps} />,
    book: <StationBook {...stationProps} />,
    quiz: <StationQuiz {...stationProps} />,
    champion: <StationChampion {...stationProps} />,
  };

  const progressPct = Math.round((completed.size / SLIDES.length) * 100);

  return (
    <div ref={rootRef} className="pattern-bg min-h-screen pb-32">
      <Confetti show={confetti} />

      {/* الشريط العلوي */}
      <header className="sticky top-0 z-30 border-b border-turq-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <button
            onClick={() => setNavOpen((v) => !v)}
            className="touch-target rounded-2xl bg-turq-50 px-3 text-2xl text-turq-700 lg:hidden"
            aria-label="قائمة المحطات"
          >
            ☰
          </button>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-turq-500 to-brand-blue text-2xl text-white shadow">
              🕌
            </div>
            <div>
              <p className="text-sm text-slate-500">{state.student.classroom}</p>
              <p className="text-lg font-black text-turq-900">{state.student.name}</p>
            </div>
          </div>
          <div className="mx-auto hidden flex-1 items-center gap-3 px-6 md:flex">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-turq-100">
              <div className="h-full rounded-full bg-gradient-to-l from-turq-500 to-brand-green transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-sm font-bold text-turq-800">{progressPct}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-800" title="النقاط">
              🏅 {state.progress.points}
            </span>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-black text-orange-800" title="النجوم">
              ⭐ {state.progress.stars}
            </span>
            <span className="hidden rounded-full bg-sky-100 px-3 py-1 text-sm font-black text-sky-800 sm:inline" title="الأوسمة">
              🎖️ {state.achievements.length}
            </span>
            <button
              onClick={() => setSoundOn((v) => !v)}
              className="touch-target rounded-2xl bg-slate-100 px-3 text-xl"
              aria-label="تشغيل/إيقاف الأصوات"
              title="الأصوات"
            >
              {soundOn ? "🔔" : "🔕"}
            </button>
            <button
              onClick={() => setReduceMotion((v) => !v)}
              className="touch-target hidden rounded-2xl bg-slate-100 px-3 text-xl sm:block"
              aria-label="تخفيف الحركة"
              title="تخفيف الحركة"
            >
              {reduceMotion ? "🐢" : "✨"}
            </button>
            <Btn variant="ghost" size="sm" onClick={exit} title="إنهاء الجلسة">
              خروج
            </Btn>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]">
        {/* قائمة المحطات */}
        <aside
          className={cx(
            "rounded-3xl bg-white/80 p-4 shadow-lg shadow-turq-900/5 backdrop-blur lg:sticky lg:top-24 lg:block lg:self-start",
            navOpen ? "block" : "hidden",
          )}
        >
          <h3 className="mb-3 text-sm font-black text-slate-500">محطات الرحلة</h3>
          <ol className="space-y-1">
            {SLIDES.map((s, i) => {
              const isDone = completed.has(s.key);
              const unlocked = i <= firstIncomplete || isDone;
              const active = i === current;
              return (
                <li key={s.key}>
                  <button
                    disabled={!unlocked}
                    onClick={() => goTo(i)}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-start transition-colors",
                      active ? "bg-turq-600 text-white shadow" : unlocked ? "hover:bg-turq-50" : "opacity-40",
                    )}
                  >
                    <span
                      className={cx(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black",
                        isDone ? "bg-brand-green text-white" : active ? "bg-white text-turq-700" : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {isDone ? "✓" : i + 1}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-bold leading-tight">{s.title}</span>
                      <span className={cx("block text-xs", active ? "text-turq-100" : "text-slate-400")}>{s.strategy}</span>
                    </span>
                    <span className="text-lg">{unlocked ? s.emoji : "🔒"}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {state.certificate && (
            <Link
              href={`/certificate/${state.certificate.serial}`}
              className="mt-4 block rounded-2xl bg-gradient-to-l from-amber-400 to-orange-500 p-3 text-center font-black text-white shadow"
            >
              🎓 عرض شهادتي
            </Link>
          )}
        </aside>

        {/* المحطة الحالية */}
        <main className="min-w-0">
          <div className="mb-4 flex items-center justify-between text-sm font-bold text-turq-700">
            <span>
              المحطة {current + 1} من {SLIDES.length}
            </span>
            <span className="rounded-full bg-white px-3 py-1 shadow-sm">{SLIDES[current].strategy}</span>
          </div>
          <div key={currentKey}>{stations[currentKey]}</div>
        </main>
      </div>

      {/* شريط التنقل السفلي */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-turq-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Btn variant="secondary" onClick={() => current > 0 && goTo(current - 1)} disabled={current === 0}>
            → السابق
          </Btn>
          <div className="flex items-center gap-1" aria-hidden>
            {SLIDES.map((s, i) => (
              <span
                key={s.key}
                className={cx(
                  "h-2.5 w-2.5 rounded-full transition-all",
                  i === current ? "w-6 bg-turq-600" : completed.has(s.key) ? "bg-brand-green" : "bg-slate-200",
                )}
              />
            ))}
          </div>
          {current < SLIDES.length - 1 ? (
            <Btn variant={done ? "success" : "secondary"} onClick={goNext} disabled={!done || busy} title={done ? "" : "أكمل أنشطة المحطة أولًا"}>
              {done ? "التالي ←" : "أكمل النشاط أولًا"}
            </Btn>
          ) : (
            <span className="text-sm font-bold text-turq-700">نهاية الرحلة 🎉</span>
          )}
        </div>
      </nav>

      {/* التنبيهات */}
      <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "animate-pop rounded-2xl px-5 py-3 text-base font-bold shadow-xl",
              t.kind === "ok" && "bg-brand-green text-white",
              t.kind === "err" && "bg-rose-600 text-white",
              t.kind === "badge" && "bg-gradient-to-l from-amber-400 to-orange-500 text-white",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
