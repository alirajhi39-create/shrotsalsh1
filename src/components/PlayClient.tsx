"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { getToken, playFetch, setToken } from "@/lib/client-auth";
import { LIVE_MODE_LABELS, type LivePlayerState } from "@/lib/live-quiz";
import { Btn, Confetti, cx } from "@/components/lesson/ui";

export default function PlayClient({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [state, setState] = useState<LivePlayerState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [answering, setAnswering] = useState(false);
  const polling = useRef(false);
  // نسخة فورية لا تعتمد على نجاح التخزين أو تحديث الرابط داخل الإطارات المقيّدة.
  const tokenRef = useRef<string | null>(null);
  const authFailures = useRef(0);

  const clearSession = useCallback((message: string) => {
    tokenRef.current = null;
    setToken("play", null);
    setState(null);
    setError(message);
  }, []);

  const refresh = useCallback(async () => {
    if (polling.current) return;
    if (!tokenRef.current) tokenRef.current = getToken("play");
    const token = tokenRef.current;
    if (!token) return;
    polling.current = true;
    try {
      const r = await playFetch("/api/play/state", { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (r.ok && d.state) {
        // لا نستبدل الجلسة إذا كان الرد يخص لاعبًا آخر (تبويب آخر مثلًا).
        if (tokenRef.current === token) { setState(d.state); setError(""); authFailures.current = 0; }
      } else if (r.status === 403 || r.status === 410) {
        clearSession(d.error ?? "انتهت صلاحية المشاركة");
      } else if (r.status === 401) {
        authFailures.current += 1;
        const recovered = getToken("play");
        if (recovered && recovered !== token) { tokenRef.current = recovered; authFailures.current = 0; }
        else if (authFailures.current >= 4) clearSession("تعذر استعادة جلسة اللاعب. انضم مرة أخرى برمز الغرفة.");
        else setError("نعيد الاتصال بالمسابقة… لا تغلق الصفحة.");
      } else setError(d.error ?? "تعذر تحديث المسابقة");
    } catch { setError("انقطع الاتصال مؤقتًا؛ سنحاول مجددًا دون الخروج من المسابقة."); }
    finally { polling.current = false; }
  }, [clearSession]);

  useEffect(() => {
    tokenRef.current = getToken("play");
    void refresh();
    const t = setInterval(() => void refresh(), 1500);
    const resume = () => void refresh();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { clearInterval(t); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
  }, [refresh]);

  const join = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const r = await fetch("/api/play/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, name }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "تعذر الانضمام"); return; }
      tokenRef.current = d.token; authFailures.current = 0; setToken("play", d.token); setCode(d.code);
      await refresh();
    } catch { setError("تعذر الاتصال بالخادم"); }
    finally { setBusy(false); }
  };

  const answer = async (optionId: string) => {
    if (!state || answering || state.ownAnswer || !tokenRef.current) return;
    setAnswering(true); setError("");
    try {
      const r = await playFetch("/api/play/answer", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` }, body: JSON.stringify({ roundIndex: state.currentRound, optionId }) });
      const d = await r.json();
      if (!r.ok) setError(d.error ?? "تعذر إرسال الإجابة");
      await refresh();
    } catch { setError("لم تصل الإجابة؛ حاول مرة أخرى"); }
    finally { setAnswering(false); }
  };

  const leave = () => { tokenRef.current = null; setToken("play", null); setState(null); setName(""); setError(""); };
  const revealed = state?.status === "reveal" || state?.status === "ended";

  return <main className="pattern-bg min-h-screen px-4 py-6"><div className="mx-auto max-w-2xl space-y-5">
    <header className="flex items-center justify-between gap-3"><Link href="/" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-turq-700 shadow">🕌 الدرس</Link><div className="text-center"><h1 className="text-2xl font-black text-turq-900">مسابقة شروط الصلاة</h1><p className="text-sm text-slate-500">أجب من جوالك وتابع نتيجتك على السبورة</p></div><span className="text-3xl">📱</span></header>
    {error && <div role="alert" className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-3 font-bold text-rose-800">{error}</div>}
    {!state ? <section className="rounded-3xl bg-white p-6 shadow-xl"><div className="mb-5 text-center"><div className="text-6xl">🎮</div><h2 className="mt-2 text-2xl font-black text-turq-900">انضم إلى المسابقة</h2><p className="mt-1 text-slate-600">أدخل رمز الغرفة الذي يعرضه المعلم على السبورة.</p></div><form onSubmit={join} className="space-y-4"><label className="block font-bold text-slate-700">رمز الغرفة<input value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))} required minLength={6} maxLength={8} dir="ltr" placeholder="ABC123" className="mt-1 w-full rounded-2xl border-2 border-turq-200 p-4 text-center font-mono text-3xl font-black tracking-[0.25em] focus:border-turq-500 focus:outline-none" /></label><label className="block font-bold text-slate-700">اسم الطالب<input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={40} placeholder="اكتب اسمك واسم العائلة" className="mt-1 w-full rounded-2xl border-2 border-slate-200 p-4 text-lg focus:border-turq-500 focus:outline-none" /></label><Btn type="submit" size="lg" className="w-full" disabled={busy || code.length < 6 || name.trim().length < 2}>{busy ? "جارٍ الانضمام…" : "انضم إلى الغرفة 🚀"}</Btn></form><p className="mt-4 text-center text-xs text-slate-500">لا تحتاج إلى حساب الدرس. انتظر بدء المعلم قبل الإجابة.</p></section> : <>
      <Confetti show={state.status === "ended" && state.player.rank === 1} />
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-4 shadow"><div><p className="text-xs text-slate-500">الغرفة <b className="font-mono text-turq-700">{state.code}</b> · {LIVE_MODE_LABELS[state.mode]}</p><p className="text-xl font-black text-turq-900">{state.player.name}</p></div><div className="flex gap-2"><span className="rounded-2xl bg-amber-100 px-4 py-2 font-black text-amber-800">🏅 {state.player.score}</span><span className="rounded-2xl bg-turq-100 px-4 py-2 font-black text-turq-800">الترتيب {state.player.rank}</span></div></section>
      {state.status === "lobby" ? <section className="rounded-3xl bg-white p-8 text-center shadow-xl"><div className="animate-float text-7xl">⏳</div><h2 className="mt-4 text-2xl font-black text-turq-900">أنت داخل الغرفة!</h2><p className="mt-2 text-lg text-slate-600">انتظر حتى يبدأ المعلم السؤال الأول. ستظهر الخيارات هنا تلقائيًا.</p></section> : <>
        <section className="rounded-3xl bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between gap-2"><span className="rounded-full bg-turq-100 px-3 py-1 text-sm font-black text-turq-800">السؤال {state.currentRound + 1} من {state.totalRounds}</span><span className={cx("rounded-full px-4 py-1 font-black", state.status === "active" && state.timeLeft <= 5 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700")}>{state.status === "active" ? `⏱️ ${state.timeLeft} ث` : state.status === "reveal" ? "كشف الإجابة" : "انتهت المسابقة"}</span></div><h2 className="mb-5 text-center text-2xl font-black leading-relaxed text-turq-900">{state.question?.prompt}</h2><div className={cx("grid gap-3", state.question?.options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>{state.question?.options.map((o, i) => { const selected = state.ownAnswer?.optionId === o.id; const correct = revealed && state.question?.correctOptionId === o.id; const wrong = revealed && selected && !correct; return <button key={o.id} onClick={() => void answer(o.id)} disabled={state.status !== "active" || !!state.ownAnswer || answering || state.timeLeft === 0} className={cx("touch-target min-h-24 rounded-3xl border-4 p-4 text-xl font-black transition-all", correct ? "border-emerald-500 bg-emerald-50 text-emerald-900" : wrong ? "border-rose-400 bg-rose-50 text-rose-900" : selected ? "border-turq-500 bg-turq-50 text-turq-900" : "border-slate-200 bg-white hover:border-turq-400", state.status !== "active" && !correct && !wrong && "opacity-70")}><span className="mb-1 block text-3xl">{o.emoji ?? ["🔵", "", "🟢", "🟣", "🔴", ""][i]}</span>{o.label}{selected && <span className="mt-1 block text-xs">اختيارك</span>}{correct && <span className="mt-1 block text-xs">الإجابة الصحيحة ✓</span>}</button>; })}</div>
        <div className="mt-5">{state.status === "active" && state.timeLeft === 0 ? <p className="rounded-2xl bg-amber-50 p-3 text-center font-bold text-amber-800">انتهى الوقت؛ انتظر كشف المعلم للإجابة.</p> : state.ownAnswer ? revealed ? <p className={cx("rounded-2xl p-4 text-center text-lg font-black", state.ownAnswer.isCorrect ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800")}>{state.ownAnswer.isCorrect ? "أحسنت! إجابة صحيحة +1 نقطة" : "حاول في السؤال القادم. الإجابة الصحيحة موضحة بالأخضر."}</p> : <p className="rounded-2xl bg-turq-50 p-4 text-center font-bold text-turq-800">✓ وصلت إجابتك. انتظر بقية الطلاب وكشف المعلم للنتيجة.</p> : answering ? <p className="text-center font-bold text-slate-500">جارٍ إرسال إجابتك…</p> : state.status === "active" ? <p className="text-center font-bold text-slate-500">اختر إجابة واحدة من جوالك.</p> : null}{revealed && state.question?.explanation && <p className="mt-3 rounded-2xl bg-sky-50 p-3 text-center font-semibold text-sky-900">{state.question.explanation}</p>}</div></section>
      </>}
      <section className="rounded-3xl bg-white p-5 shadow"><h3 className="mb-3 text-lg font-black text-turq-900">{state.status === "ended" ? "🏆 الترتيب النهائي" : "📊 لوحة المتصدرين"}</h3><ol className="space-y-2">{state.leaderboard.slice(0, 10).map(p => <li key={p.id} className={cx("flex items-center gap-3 rounded-2xl px-3 py-2", p.id === state.player.id ? "bg-turq-100 font-black" : "bg-slate-50")}><span className="grid h-8 w-8 place-items-center rounded-full bg-white font-black">{p.rank <= 3 ? ["🥇", "🥈", "🥉"][p.rank - 1] : p.rank}</span><span className="flex-1">{p.name}</span><span>{p.score} نقطة</span></li>)}</ol></section>
      <div className="flex justify-center"><Btn variant="ghost" size="sm" onClick={leave}>مغادرة الغرفة</Btn></div>
    </>}
  </div></main>;
}
