"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Btn, Confetti, cx, useSounds } from "@/components/lesson/ui";
import IframeHint from "@/components/IframeHint";

type Zone = { id: string; label: string; emoji: string };
type State = {
  ok?: boolean;
  error?: string;
  code: string;
  index: number;
  total: number;
  finished: boolean;
  reveal: boolean;
  question: { label: string } | null;
  zones: Zone[];
  me: { name: string; score: number; answered: boolean; choice: string | null; correct: boolean } | null;
  answeredCount: number;
  totalPlayers: number;
  correctZone: string | null;
  leaderboard: { rank: number; name: string; score: number }[];
};

export default function StudentRoom() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const sounds = useSounds(true);
  const prevReveal = useRef(false);

  const poll = useCallback(async () => {
    if (!playerId || !code) return;
    try {
      const res = await fetch(`/api/room/play?code=${encodeURIComponent(code)}&playerId=${encodeURIComponent(playerId)}`, { cache: "no-store" });
      if (res.status === 404) {
        setState(null);
        setError("انتهت المسابقة أو أغلقها المعلم");
        return;
      }
      const d = (await res.json()) as State;
      setState(d);
      setError(null);
      if (d.reveal && !prevReveal.current) {
        if (d.me?.correct) {
          sounds.success();
          setConfetti(true);
          setTimeout(() => setConfetti(false), 2600);
        } else if (d.me?.answered) sounds.error();
      }
      prevReveal.current = d.reveal;
    } catch {
      /* تجاهل انقطاع مؤقت */
    }
  }, [playerId, code, sounds]);

  useEffect(() => {
    if (!joined || !playerId) return;
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, [joined, playerId, poll]);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/room/play", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), name: name.trim() }),
      });
      const d = (await res.json()) as { ok?: boolean; playerId?: string; error?: string };
      if (!res.ok || !d.playerId) {
        setError(d.error ?? "تعذر الانضمام");
        return;
      }
      setPlayerId(d.playerId);
      setJoined(true);
      sounds.click();
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  };

  const answer = async (choice: string) => {
    if (!playerId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/room/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, playerId, action: "answer", choice }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) setError(d.error ?? "تعذر إرسال الإجابة");
      else {
        setError(null);
        sounds.click();
        poll();
      }
    } catch {
      setError("تعذر الاتصال");
    } finally {
      setBusy(false);
    }
  };

  /* ---------- شاشة الانضمام ---------- */
  if (!joined) {
    return (
      <main className="pattern-bg grid min-h-screen place-items-center p-4">
        <div className="w-full max-w-md">
          <IframeHint />
          <div className="rounded-3xl bg-white p-6 shadow-2xl shadow-turq-900/10">
            <div className="mb-5 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-turq-500 to-brand-blue text-3xl text-white">🎮</div>
              <h1 className="mt-3 text-2xl font-black text-turq-900">انضم إلى المسابقة</h1>
              <p className="text-sm text-slate-500">أدخل الرمز الذي يظهر على السبورة الذكية</p>
            </div>
            <form onSubmit={join} className="space-y-4">
              <label className="block">
                <span className="mb-1 block font-bold text-slate-700">رمز الغرفة</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  required
                  placeholder="0000"
                  className="w-full rounded-2xl border-2 border-slate-200 p-4 text-center font-mono text-4xl tracking-[0.5em] focus:border-turq-400 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-bold text-slate-700">اسمك</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={40}
                  placeholder="اكتب اسمك"
                  className="w-full rounded-2xl border-2 border-slate-200 p-4 text-lg focus:border-turq-400 focus:outline-none"
                />
              </label>
              {error && <p className="rounded-2xl bg-rose-50 p-3 font-bold text-rose-700">{error}</p>}
              <Btn type="submit" size="lg" className="w-full" disabled={busy || code.length < 3}>
                {busy ? "لحظة…" : "انضمام 🚀"}
              </Btn>
            </form>
          </div>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="text-center">
          {error ? <p className="text-xl font-bold text-rose-700">{error}</p> : <div className="mx-auto h-14 w-14 animate-spin rounded-full border-8 border-turq-200 border-t-turq-600" />}
        </div>
      </main>
    );
  }

  const me = state.me;
  const waiting = me?.answered && !state.reveal;

  return (
    <main className="pattern-bg min-h-screen p-4 pb-10">
      <Confetti show={confetti} />
      <header className="mx-auto mb-4 flex max-w-md flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/90 p-3 shadow">
        <div>
          <p className="text-xs text-slate-500">رمز الغرفة</p>
          <p className="font-mono text-2xl font-black tracking-widest text-turq-700">{state.code}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500">نقاطك</p>
          <p className="text-2xl font-black text-brand-orange">{me?.score ?? 0}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500">السؤال</p>
          <p className="text-lg font-black text-turq-700">
            {state.index + 1}/{state.total}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4">
        {error && <div className="rounded-2xl bg-rose-50 p-3 text-center font-bold text-rose-700">{error}</div>}

        {state.finished ? (
          <div className="rounded-3xl bg-white p-6 text-center shadow-xl">
            <div className="text-6xl">🏁</div>
            <h2 className="mt-2 text-2xl font-black text-turq-900">انتهت المسابقة!</h2>
            <p className="mt-1 text-lg">
              نتيجتك: <b className="text-brand-orange">{me?.score ?? 0}</b> نقطة
            </p>
            {state.leaderboard[0] && (
              <p className="mt-2 font-bold text-emerald-700">
                🏆 الفائز: {state.leaderboard[0].name} ({state.leaderboard[0].score})
              </p>
            )}
            <ol className="mt-4 space-y-1 text-start">
              {state.leaderboard.map((l) => (
                <li key={l.rank} className={cx("flex justify-between rounded-xl px-3 py-2 text-sm font-bold", l.name === me?.name ? "bg-turq-600 text-white" : "bg-slate-50")}>
                  <span>
                    {l.rank === 1 ? "🥇" : l.rank === 2 ? "🥈" : l.rank === 3 ? "🥉" : `${l.rank}.`} {l.name}
                  </span>
                  <span>{l.score}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : !state.question ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow">
            <div className="animate-float text-6xl">⏳</div>
            <p className="mt-3 text-lg font-bold text-turq-800">بانتظار بدء المعلم…</p>
            <p className="mt-1 text-sm text-slate-500">أنت مسجّل باسم {me?.name}</p>
          </div>
        ) : (
          <>
            <div className="rounded-3xl bg-white p-5 text-center shadow-lg">
              <p className="text-sm font-bold text-slate-500">
                أجاب {state.answeredCount} من {state.totalPlayers}
              </p>
              <p className="mt-2 text-2xl font-black leading-relaxed text-turq-900">{state.question.label}</p>
            </div>

            {!state.reveal ? (
              waiting ? (
                <div className="rounded-3xl bg-emerald-50 p-6 text-center shadow">
                  <div className="animate-float text-5xl">✅</div>
                  <p className="mt-2 text-lg font-black text-emerald-800">تم إرسال إجابتك!</p>
                  <p className="text-sm text-emerald-700">بانتظار بقية الطلاب…</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {state.zones.map((z) => (
                    <button
                      key={z.id}
                      type="button"
                      disabled={busy}
                      onClick={() => answer(z.id)}
                      className="touch-target flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4 text-lg font-black text-slate-800 shadow transition-all active:scale-95 hover:border-turq-500 hover:bg-turq-50 disabled:opacity-50"
                    >
                      <span className="text-3xl">{z.emoji}</span>
                      {z.label}
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div
                className={cx(
                  "rounded-3xl border-4 p-5 text-center shadow-lg",
                  me?.correct ? "border-emerald-400 bg-emerald-50" : me?.answered ? "border-rose-300 bg-rose-50" : "border-slate-300 bg-white",
                )}
              >
                <div className="text-5xl">{me?.correct ? "🎉" : me?.answered ? "💪" : "⏱️"}</div>
                <p className="mt-2 text-xl font-black text-turq-900">
                  {me?.correct ? "أحسنت! إجابة صحيحة" : me?.answered ? "لم تكن صحيحة" : "لم تُجب على هذا السؤال"}
                </p>
                <p className="mt-1 font-bold text-slate-700">
                  الإجابة الصحيحة: {state.zones.find((z) => z.id === state.correctZone)?.label ?? "—"}
                </p>
              </div>
            )}

            {state.reveal && state.leaderboard.length > 0 && (
              <div className="rounded-3xl bg-white p-4 shadow">
                <h3 className="mb-2 text-center font-black text-turq-900">🏆 المتصدرون</h3>
                <ol className="space-y-1">
                  {state.leaderboard.map((l) => (
                    <li key={l.rank} className={cx("flex justify-between rounded-xl px-3 py-1.5 text-sm font-bold", l.name === me?.name ? "bg-turq-600 text-white" : "bg-slate-50")}>
                      <span>
                        {l.rank}. {l.name}
                      </span>
                      <span>{l.score}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
