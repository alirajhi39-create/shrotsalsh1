"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { teacherFetch } from "@/lib/client-auth";
import { LIVE_MODE_LABELS, type LiveHostState, type LiveMode } from "@/lib/live-quiz";
import { Btn, Confetti, cx, useSounds } from "@/components/lesson/ui";
import BoardGame from "./BoardGame";

type RoomRow = { code: string; mode: LiveMode; status: string; createdAt: string; expiresAt: string };
type Action = "start" | "reveal" | "next" | "end" | "kick" | "pauseTimer" | "resumeTimer" | "addTime" | "setTimer";
const card = "rounded-3xl bg-white p-5 shadow";

function Progress({ value, max, label, color = "bg-turq-500" }: { value: number; max: number; label: string; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return <div><div className="mb-1 flex justify-between text-sm font-bold text-slate-600"><span>{label}</span><span>{value} / {max} · {pct}%</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}><div className={cx("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} /></div></div>;
}

export default function LiveQuizBoard() {
  const [view, setView] = useState<"remote" | "local">("remote");
  const [mode, setMode] = useState<LiveMode>("mixed");
  const [seconds, setSeconds] = useState(30);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [questionCount, setQuestionCount] = useState(15);
  const [state, setState] = useState<LiveHostState | null>(null);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const sounds = useSounds(soundOn);
  const lastSound = useRef("");
  const polling = useRef(false);
  const questionRef = useRef<HTMLElement | null>(null);
  const code = state?.code;

  const loadRooms = useCallback(async () => { try { const r = await teacherFetch("/api/teacher/live-quiz"); const d = await r.json(); if (r.ok) setRooms(d.rooms ?? []); } catch { /* تجاهل */ } }, []);
  const refresh = useCallback(async () => {
    if (!code || polling.current) return;
    polling.current = true;
    try { const r = await teacherFetch(`/api/teacher/live-quiz/${code}`); const d = await r.json(); if (r.ok && d.state) { setState(d.state); } else setError(d.error ?? "تعذر تحديث الغرفة"); }
    catch { setError("انقطع الاتصال؛ نحاول مجددًا"); }
    finally { polling.current = false; }
  }, [code]);
  useEffect(() => { void loadRooms(); }, [loadRooms]);
  useEffect(() => { if (!code) return; void refresh(); const t = setInterval(() => void refresh(), 1000); return () => clearInterval(t); }, [code, refresh]);
  useEffect(() => { if (state?.currentRound !== undefined) questionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, [state?.currentRound]);
  useEffect(() => { if (state) setTimerSeconds(state.questionSeconds); }, [state?.questionSeconds]);
  useEffect(() => {
    if (!state || (state.status !== "reveal" && state.status !== "ended")) return;
    const key = `${state.code}-${state.currentRound}-${state.status}`;
    if (lastSound.current === key) return;
    lastSound.current = key;
    if (state.correctCount > 0) sounds.success();
    if (state.wrongCount > 0) setTimeout(() => sounds.error(), state.correctCount > 0 ? 450 : 0);
    if (state.status === "ended") sounds.fanfare();
  }, [state, sounds]);

  const joinUrl = state && typeof window !== "undefined" ? `${window.location.origin}${state.joinPath}` : "";
  useEffect(() => { if (!joinUrl) { setQr(""); return; } let alive = true; QRCode.toDataURL(joinUrl, { width: 240, margin: 2, errorCorrectionLevel: "M", color: { dark: "#174a4b", light: "#ffffff" } }).then(url => { if (alive) setQr(url); }).catch(() => setQr("")); return () => { alive = false; }; }, [joinUrl]);

  const create = async () => {
    setBusy(true); setError(""); sounds.unlock();
    try {
      const r = await teacherFetch("/api/teacher/live-quiz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, questionSeconds: seconds, timerEnabled, ...(mode === "mixed" || mode === "assessment" ? { questionCount } : {}) }) });
      const d = await r.json(); if (!r.ok) { setError(d.error ?? "تعذر إنشاء الغرفة"); return; }
      setState(d.state); setTimerSeconds(d.state.questionSeconds); await loadRooms();
    } catch { setError("تعذر الاتصال بالخادم"); } finally { setBusy(false); }
  };
  const open = async (roomCode: string) => { setBusy(true); setError(""); try { const r = await teacherFetch(`/api/teacher/live-quiz/${roomCode}`); const d = await r.json(); if (r.ok) { setState(d.state); setTimerSeconds(d.state.questionSeconds); } else setError(d.error ?? "تعذر فتح الغرفة"); } catch { setError("تعذر الاتصال"); } finally { setBusy(false); } };
  const action = async (action: Action, options: Record<string, unknown> = {}) => {
    if (!state) return; setBusy(true); setError(""); sounds.unlock();
    try {
      const r = await teacherFetch(`/api/teacher/live-quiz/${state.code}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...options }) });
      const d = await r.json(); if (r.ok) { setState(d.state); sounds.click(); } else setError(d.error ?? "تعذر تنفيذ الأمر"); await loadRooms();
    } catch { setError("تعذر الاتصال بالخادم"); } finally { setBusy(false); }
  };
  const copy = async (text: string, label: string) => { try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(""), 2000); } catch { setError("تعذر النسخ التلقائي؛ انسخ الرمز أو الرابط الظاهر يدويًا"); } };
  const revealed = state?.status === "reveal" || state?.status === "ended";
  const timerPct = state?.timerEnabled && state.questionSeconds > 0 ? Math.min(100, Math.round((state.timeLeft / state.questionSeconds) * 100)) : 0;

  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2 rounded-3xl bg-white p-3 shadow"><Btn variant={view === "remote" ? "primary" : "secondary"} onClick={() => setView("remote")}>📱 مسابقة الجوالات المباشرة</Btn><Btn variant={view === "local" ? "primary" : "secondary"} onClick={() => setView("local")}>🖥️ النشاط المحلي على السبورة</Btn><Btn variant="ghost" size="sm" className="ms-auto" onClick={() => { setSoundOn(v => !v); sounds.unlock(); }}>{soundOn ? "🔊 أصوات النتائج مفعلة" : "🔇 أصوات النتائج مكتومة"}</Btn></div>
    {view === "local" ? <BoardGame /> : <div className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-l from-turq-50 to-sky-50 p-5"><h1 className="text-3xl font-black text-turq-900">مسابقة السبورة عن بُعد</h1><p className="mt-2 text-slate-600">أنشئ الغرفة، دع الطلاب يدخلون، ثم اضغط «بدء المسابقة». تابع المؤقت وتقدم الإجابات والنتائج مباشرة من هذه الشاشة.</p></div>
      {error && <div role="alert" className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-3 font-bold text-rose-800">{error}</div>}
      {!state ? <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className={card}><h2 className="mb-4 text-xl font-black text-turq-900">إنشاء غرفة جديدة</h2>
          <label className="block font-bold text-slate-700">النشاط<select value={mode} onChange={e => setMode(e.target.value as LiveMode)} className="mt-1 w-full rounded-2xl border-2 border-slate-200 p-3">{(Object.keys(LIVE_MODE_LABELS) as LiveMode[]).map(m => <option key={m} value={m}>{LIVE_MODE_LABELS[m]}</option>)}</select></label>
          {(mode === "mixed" || mode === "assessment") && <label className="mt-4 block font-bold text-slate-700">عدد الأسئلة<select value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))} className="mt-1 w-full rounded-2xl border-2 border-slate-200 p-3">{[5, 10, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n} أسئلة (أو المتاح إن كان أقل)</option>)}</select></label>}
          <div className="mt-4 rounded-2xl border-2 border-turq-100 bg-turq-50 p-4"><label className="flex items-center gap-3 font-black text-turq-900"><input type="checkbox" checked={timerEnabled} onChange={e => setTimerEnabled(e.target.checked)} className="h-5 w-5" />⏱️ تفعيل المؤقت الزمني للأسئلة</label><label className="mt-3 block font-bold text-slate-700">وقت السؤال<select value={seconds} disabled={!timerEnabled} onChange={e => setSeconds(Number(e.target.value))} className="mt-1 w-full rounded-2xl border-2 border-slate-200 bg-white p-3 disabled:opacity-50">{[15, 20, 30, 45, 60, 90, 120].map(s => <option key={s} value={s}>{s} ثانية</option>)}</select></label><p className="mt-2 text-xs text-slate-500">يمكنك إيقاف المؤقت مؤقتًا، استئنافه، زيادة الوقت، أو تغيير المدة أثناء المسابقة.</p></div>
          <Btn size="lg" className="mt-5 w-full" onClick={create} disabled={busy}>{busy ? "جارٍ الإنشاء…" : "إنشاء الغرفة واستقبال الطلاب 🚀"}</Btn><p className="mt-3 text-xs text-slate-500">تُحفظ الإجابات والنتائج في قاعدة البيانات. صلاحية الغرفة 6 ساعات، وحتى 100 لاعب.</p>
        </section>
        <section className={card}><h2 className="mb-3 text-lg font-black text-turq-900">غرفك الأخيرة</h2>{rooms.length ? <ul className="space-y-2">{rooms.map(r => <li key={r.code}><button onClick={() => void open(r.code)} className="w-full rounded-2xl bg-slate-50 p-3 text-start hover:bg-turq-50"><span className="font-mono text-xl font-black text-turq-800">{r.code}</span><span className="ms-2 text-xs text-slate-500">{r.status === "ended" ? "منتهية" : r.status === "lobby" ? "انتظار" : "جارية"}</span><span className="block text-xs text-slate-500">{LIVE_MODE_LABELS[r.mode]} · {new Date(r.createdAt).toLocaleString("ar-SA")}</span></button></li>)}</ul> : <p className="text-sm text-slate-500">لا توجد غرف بعد.</p>}</section>
      </div> : <>
        <Confetti show={state.status === "ended"} />
        <section className="grid gap-5 rounded-3xl bg-white p-5 shadow-xl lg:grid-cols-[1fr_240px]"><div><div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-turq-100 px-3 py-1 font-bold text-turq-800">{state.status === "lobby" ? "بانتظار الطلاب" : state.status === "active" ? "السؤال مفتوح" : state.status === "reveal" ? "كشف الإجابة" : "انتهت المسابقة"}</span><span className="font-bold text-slate-600">👥 {state.playerCount} لاعب</span><span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-800">{LIVE_MODE_LABELS[state.mode]} · {state.totalRounds} سؤالًا</span><button onClick={() => setState(null)} className="ms-auto rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold">العودة للغرف</button></div><p className="mt-4 text-slate-600">يمسح الطلاب QR أو يفتحون <b dir="ltr">/play</b> ويدخلون الرمز:</p><div className="mt-2 flex flex-wrap items-center gap-3"><span className="rounded-2xl border-4 border-dashed border-brand-orange bg-orange-50 px-6 py-3 font-mono text-5xl font-black tracking-[0.2em] text-orange-700">{state.code}</span><Btn variant="secondary" size="sm" onClick={() => void copy(state.code, "الرمز")}>نسخ الرمز</Btn><Btn variant="secondary" size="sm" onClick={() => void copy(joinUrl, "الرابط")}>نسخ رابط الانضمام</Btn></div>{copied && <p className="mt-2 text-sm font-bold text-emerald-700">تم نسخ {copied}</p>}<p className="mt-2 break-all text-xs text-slate-500" dir="ltr">{joinUrl}</p></div><div className="text-center">{qr && <img src={qr} alt="رمز QR لانضمام الطلاب" className="mx-auto h-48 w-48" />}<a href={joinUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-turq-700 underline">فتح صفحة الطالب ↗</a></div></section>
        <section className={card}><h2 className="mb-4 text-lg font-black text-turq-900">📈 تقدم المسابقة على شاشة المعلم</h2><div className="grid gap-4 md:grid-cols-2"><Progress label="الأسئلة المكتملة" value={state.status === "lobby" ? 0 : Math.min(state.totalRounds, state.currentRound + (revealed ? 1 : 0))} max={state.totalRounds} color="bg-brand-blue" /><Progress label="إجابات السؤال الحالي" value={state.answeredCount} max={state.playerCount} /></div><div className="mt-4 grid grid-cols-3 gap-3 text-center"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">السؤال الحالي</p><p className="text-2xl font-black text-turq-900">{state.status === "lobby" ? "—" : state.currentRound + 1}</p></div><div className="rounded-2xl bg-emerald-50 p-3"><p className="text-xs text-emerald-700">إجابات صحيحة</p><p className="text-2xl font-black text-emerald-800">{state.correctCount}</p></div><div className="rounded-2xl bg-rose-50 p-3"><p className="text-xs text-rose-700">إجابات خاطئة</p><p className="text-2xl font-black text-rose-800">{state.wrongCount}</p></div></div></section>
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]"><div className="space-y-5">
          {state.status === "lobby" ? <section className="rounded-3xl border-4 border-turq-200 bg-white p-8 text-center shadow"><div className="text-6xl">👥</div><h2 className="mt-3 text-2xl font-black text-turq-900">دخل {state.playerCount} طالب إلى الغرفة</h2><p className="mt-2 text-slate-600">عندما يصبح الطلاب جاهزين، اضغط زر البدء. لن تبدأ المسابقة تلقائيًا.</p><div className="mx-auto mt-4 flex max-w-md flex-wrap justify-center gap-2">{state.players.filter(p => p.active).map(p => <span key={p.id} className="rounded-full bg-turq-50 px-3 py-1 text-sm font-bold text-turq-800">✓ {p.name}</span>)}</div><Btn size="lg" variant="success" className="mt-6 min-w-64 text-2xl" disabled={busy || state.playerCount === 0} onClick={() => void action("start")}>▶ بدء المسابقة الآن</Btn>{state.playerCount === 0 && <p className="mt-3 text-sm font-bold text-amber-700">الزر يتفعل تلقائيًا بعد دخول أول طالب.</p>}<p className="mt-3 text-xs text-slate-500">{state.timerEnabled ? `المؤقت: ${state.questionSeconds} ثانية لكل سؤال` : "المؤقت غير مفعل؛ يمكنك تفعيله من لوحة السؤال."}</p></section> : <section ref={questionRef} className={card}>
            <div className="mb-4 rounded-2xl border-2 border-turq-100 bg-turq-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-600">⏱️ مؤقت السؤال</p><p className={cx("text-4xl font-black", state.timerEnabled && state.timeLeft <= 5 && state.status === "active" ? "text-rose-700" : "text-turq-900")}>{state.timerEnabled ? (state.timerPaused ? `${state.timeLeft} ث · متوقف مؤقتًا` : state.status === "active" ? `${state.timeLeft} ث` : "—") : "بدون مؤقت"}</p></div><div className="flex flex-wrap gap-2">{state.status === "active" && state.timerEnabled && <>{state.timerPaused ? <Btn size="sm" variant="success" disabled={busy} onClick={() => void action("resumeTimer")}>▶ استئناف</Btn> : <Btn size="sm" variant="secondary" disabled={busy} onClick={() => void action("pauseTimer")}>⏸ إيقاف مؤقت</Btn>}<Btn size="sm" variant="secondary" disabled={busy} onClick={() => void action("addTime")}>+10 ث</Btn></>}</div></div>{state.timerEnabled && <div className="mt-3 h-4 overflow-hidden rounded-full bg-white" role="progressbar" aria-label="وقت السؤال المتبقي" aria-valuenow={timerPct} aria-valuemin={0} aria-valuemax={100}><div className={cx("h-full rounded-full transition-all duration-1000", state.timeLeft <= 5 ? "bg-rose-500" : "bg-brand-orange")} style={{ width: `${state.status === "active" ? timerPct : 0}%` }} /></div>}
              {state.status === "active" && <div className="mt-3 flex flex-wrap items-end gap-2"><label className="text-xs font-bold text-slate-600">مدة السؤال<select value={timerSeconds} onChange={e => setTimerSeconds(Number(e.target.value))} className="mt-1 block rounded-xl border-2 border-slate-200 bg-white p-2">{[10, 15, 20, 30, 45, 60, 90, 120].map(s => <option key={s} value={s}>{s} ث</option>)}</select></label><Btn size="sm" disabled={busy} onClick={() => void action("setTimer", { enabled: true, seconds: timerSeconds })}>⏱️ ضبط/بدء المؤقت</Btn><Btn size="sm" variant="ghost" disabled={busy || !state.timerEnabled} onClick={() => void action("setTimer", { enabled: false })}>إلغاء المؤقت</Btn></div>}
            </div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="font-black text-turq-800">السؤال {state.currentRound + 1} من {state.totalRounds}</span><span className={cx("rounded-full px-4 py-1 font-black", state.status === "active" && state.timeLeft <= 5 && state.timerEnabled ? "bg-rose-100 text-rose-700" : "bg-slate-100")}>{state.status === "active" ? "استقبال الإجابات" : revealed ? "الإجابة الصحيحة ظاهرة" : "انتهت"}</span></div><h2 className="rounded-3xl bg-turq-50 p-5 text-center text-3xl font-black leading-relaxed text-turq-900">{state.question?.prompt}</h2><div className={cx("mt-4 grid gap-3", state.question?.options.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>{state.question?.options.map(o => { const correct = revealed && state.question?.correctOptionId === o.id; const count = state.optionCounts[o.id] ?? 0; const pct = state.answeredCount ? Math.round(count / state.answeredCount * 100) : 0; return <div key={o.id} className={cx("rounded-2xl border-4 p-4 text-center", correct ? "border-emerald-500 bg-emerald-50" : "border-slate-200")}><span className="text-3xl">{o.emoji}</span><p className="text-xl font-black">{o.label}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={cx("h-full", correct ? "bg-emerald-500" : "bg-turq-400")} style={{ width: `${pct}%` }} /></div><p className="mt-1 text-sm font-bold text-slate-500">{count} إجابة · {pct}%</p>{correct && <p className="font-black text-emerald-700">✓ الصحيحة</p>}</div>; })}</div>{revealed && state.question?.explanation && <p className="mt-4 rounded-2xl bg-sky-50 p-3 font-bold text-sky-900">{state.question.explanation}</p>}<div className="mt-5 flex flex-wrap items-center gap-3"><span className="font-bold text-slate-600">أجاب {state.answeredCount} من {state.playerCount}</span><div className="ms-auto flex flex-wrap gap-2">{state.status === "active" && <Btn variant="warning" disabled={busy} onClick={() => void action("reveal")}>كشف الإجابة الآن</Btn>}{state.status === "reveal" && <Btn variant="success" disabled={busy} onClick={() => void action("next")}>{state.currentRound + 1 >= state.totalRounds ? "إنهاء وعرض النتائج 🏆" : "السؤال التالي ←"}</Btn>}{state.status !== "ended" && <Btn variant="ghost" disabled={busy} onClick={() => { if (confirm("إنهاء المسابقة الآن؟")) void action("end"); }}>إنهاء المسابقة</Btn>}{state.status === "ended" && <Btn onClick={() => setState(null)}>غرفة جديدة</Btn>}</div></div></section>}
          <section className={card}><h3 className="mb-3 text-xl font-black text-turq-900">🏆 لوحة النتائج المباشرة</h3><ol className="space-y-2">{state.players.filter(p => p.active).map(p => <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-white text-lg font-black">{p.rank <= 3 ? ["🥇", "🥈", "🥉"][p.rank - 1] : p.rank}</span><span className="flex-1 text-lg font-bold">{p.name}</span><span className="text-sm text-slate-500">{p.correct} صحيحة</span><span className="text-xl font-black text-turq-800">{p.score}</span></li>)}</ol>{state.playerCount === 0 && <p className="py-5 text-center text-slate-500">لم ينضم طلاب بعد.</p>}</section>
        </div><aside className={card}><h3 className="mb-3 text-lg font-black text-turq-900">اللاعبون ({state.playerCount})</h3><ul className="space-y-2">{state.players.filter(p => p.active).map(p => <li key={p.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2"><span className="flex-1 text-sm font-bold">{p.name}</span>{state.answeredPlayerIds.includes(p.id) && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">أجاب</span>}<button disabled={busy} onClick={() => { if (confirm(`إخراج ${p.name} من الغرفة؟`)) void action("kick", { playerId: p.id }); }} className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">إخراج</button></li>)}</ul><p className="mt-4 text-xs leading-relaxed text-slate-500">تصل إجابات الجوالات تلقائيًا كل ثانية. لا تُحتسب إلا إجابة واحدة لكل طالب في السؤال، ولا تُقبل بعد انتهاء وقته أو أثناء إيقاف المؤقت.</p></aside></div>
      </>}
    </div>}
  </div>;
}
