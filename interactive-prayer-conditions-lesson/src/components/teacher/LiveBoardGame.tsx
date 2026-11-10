"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { teacherFetch } from "@/lib/client-auth";
import { Btn, Confetti, cx, useSounds } from "@/components/lesson/ui";

const ZONE_AR: Record<string, string> = {
  islam: "الإسلام", tamyeez: "التمييز", aql: "العقل", tahara: "الطهارة",
  najasa: "إزالة النجاسة", awrah: "ستر العورة", body: "البدن", clothes: "الملابس", place: "مكان الصلاة",
};

type Player = { id: string; name: string; score: number; answered: boolean; choice: string | null; correct: boolean };
type RoomState = {
  ok?: boolean;
  error?: string;
  code: string;
  mode: "conditions" | "najasa";
  index: number;
  total: number;
  started: boolean;
  seconds: number;
  remaining: number;
  card: { id: string; label: string; zone: string | null } | null;
  zones: { id: string; label: string; emoji: string }[];
  players: Player[];
  reveal: boolean;
  finished: boolean;
};

export default function LiveBoardGame() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [includeBook, setIncludeBook] = useState(true);
  const [seconds, setSeconds] = useState(20);
  const [remaining, setRemaining] = useState(0);
  const sounds = useSounds(true);
  const prevAnswered = useRef(0);
  const prevIndex = useRef(-1);

  const failures = useRef(0);

  const load = useCallback(async () => {
    if (!code) return;
    try {
      const res = await teacherFetch(`/api/teacher/room?code=${encodeURIComponent(code)}`);
      // أي خطأ مؤقت (انقطاع شبكة/إعادة تشغيل خادم) لا يُخرج المعلم من الغرفة
      if (!res.ok) {
        failures.current += 1;
        return;
      }
      failures.current = 0;
      const d = (await res.json()) as RoomState;
      setRoom(d);
      if (d.index !== prevIndex.current) {
        prevIndex.current = d.index;
        sounds.click();
      }
      const answered = d.players.filter((p) => p.answered).length;
      if (answered > prevAnswered.current) {
        prevAnswered.current = answered;
        sounds.click();
      }
    } catch {
      failures.current += 1;
    }
  }, [code, sounds]);

  // مزامنة المؤقّت مع الخادم كل ثانيتين، وعدّ محلي كل ثانية
  useEffect(() => {
    if (!code) return;
    load();
    const sync = setInterval(load, 2000);
    return () => clearInterval(sync);
  }, [code, load]);

  useEffect(() => {
    setRemaining(room?.remaining ?? 0);
  }, [room?.remaining]);

  useEffect(() => {
    if (!room || !room.started || !room.seconds || room.reveal || room.finished) return;
    const t = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [room?.started, room?.seconds, room?.reveal, room?.finished, room?.index]);

  // نغمة تنبيه عند انتهاء الوقت
  useEffect(() => {
    if (room?.started && room?.seconds && remaining === 0 && !room.reveal && !room.finished) {
      sounds.error();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const act = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      setBusy(true);
      try {
        const res = await teacherFetch("/api/teacher/room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, code, seconds, ...extra }),
        });
        const d = (await res.json()) as { ok?: boolean; code?: string; error?: string; finished?: boolean };
        if (!res.ok) return false;
        if (action === "create" && d.code) setCode(d.code);
        if (action === "start") {
          sounds.fanfare();
        }
        if (action === "reveal") {
          sounds.fanfare();
          setConfetti(true);
          setTimeout(() => setConfetti(false), 3000);
        }
        if (action === "close") {
          setCode(null);
          setRoom(null);
        }
        await load();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [code, seconds, load, sounds],
  );

  if (!code) {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl bg-gradient-to-l from-sky-50 to-white p-5">
          <h2 className="text-xl font-black text-turq-900">🎮 مسابقة مباشرة يشارك فيها الطلاب من أجهزتهم</h2>
          <p className="mt-2 leading-relaxed text-slate-700">
            اضغط «بدء مسابقة» ليظهر رمز من 4 أرقام على السبورة. يفتح الطلاب رابط <b>/play</b> على هواتهم، يدخلون الرمز وأسماءهم،
            ثم يجيب كل طالب بنفسه عن السؤال المعروض — وتظهر النتائج والترتيب على السبورة لحظيًا.
          </p>
          <p className="mt-2 text-sm font-bold text-brand-orange">
            نصيحة: اعرض الرابط <span className="font-mono">/play</span> مع الرمز على السبورة قبل البدء.
          </p>
          <label className="mt-3 flex items-center gap-2 rounded-2xl bg-white p-3 text-sm font-bold text-slate-700 shadow-sm">
            <input type="checkbox" checked={includeBook} onChange={(e) => setIncludeBook(e.target.checked)} className="h-5 w-5" />
            دمج أسئلة الكتاب والتقويم مع بطاقات التصنيف ({includeBook ? "بنك أسئلة موسّع" : "بطاقات التصنيف فقط"})
          </label>
          <div className="mt-3 rounded-2xl bg-white p-3 shadow-sm">
            <p className="text-sm font-bold text-slate-700">⏱️ مدة السؤال على أجهزة الطلاب</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[0, 15, 20, 30, 45, 60].map((v) => (
                <button
                  key={v}
                  onClick={() => setSeconds(v)}
                  className={cx(
                    "rounded-xl border-2 px-4 py-2 text-sm font-black transition-all",
                    seconds === v ? "border-turq-600 bg-turq-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-turq-300",
                  )}
                >
                  {v === 0 ? "بدون مؤقّت" : `${v} ثانية`}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Btn size="lg" onClick={() => act("create", { mode: "conditions", includeBook })} disabled={busy}>
            🗂️ بدء مسابقة «صنّف الشروط»
          </Btn>
          <Btn size="lg" variant="warning" onClick={() => act("create", { mode: "najasa", includeBook })} disabled={busy}>
            🧼 بدء مسابقة «مواضع النجاسة»
          </Btn>
        </div>
      </div>
    );
  }

  if (!room) {
    return <p className="rounded-3xl bg-white p-6 shadow">جارٍ تحميل بيانات الغرفة…</p>;
  }

  const answered = room.players.filter((p) => p.answered).length;
  const zoneLabel = (id: string | null) => {
    if (!id) return "—";
    return room.zones.find((z) => z.id === id)?.label ?? ZONE_AR[id] ?? id;
  };

  return (
    <div className="space-y-4">
      <Confetti show={confetti} />

      {/* بطاقة الرمز — تُعرض للطلاب على السبورة */}
      <div className="rounded-3xl border-4 border-brand-orange bg-gradient-to-l from-amber-50 to-white p-6 text-center shadow-xl">
        <p className="text-lg font-black text-orange-700">رمز الانضمام — افتحوا الرابط على هواتكم</p>
        <p className="my-1 font-mono text-sm text-slate-500">{typeof window !== "undefined" ? `${window.location.origin}/play` : "/play"}</p>
        <p className="font-mono text-7xl font-black tracking-[0.4em] text-turq-700">{room.code}</p>
        <p className="mt-1 text-sm font-bold text-slate-600">
          الطلاب المنضمون: {room.players.length} — أجابوا: {answered}
        </p>
      </div>

      {/* شريط التقدم والمؤقّت */}
      <div className="rounded-3xl bg-white p-4 shadow">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="font-black text-turq-900">
            التقدم: السؤال {room.index + 1} من {room.total}
          </span>
          {room.started && room.seconds > 0 && !room.finished && (
            <span
              className={cx(
                "rounded-2xl px-4 py-1 text-2xl font-black tabular-nums",
                !room.reveal && remaining <= 5 ? "animate-pulse bg-rose-100 text-rose-700" : "bg-turq-50 text-turq-800",
              )}
            >
              ⏱️ {remaining} ث
            </span>
          )}
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-l from-turq-500 to-brand-blue transition-all"
            style={{ width: `${((room.index + (room.reveal ? 1 : 0)) / room.total) * 100}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-500">
          <span>أجابوا: {answered} من {room.players.length}</span>
          <span>{Math.round(((room.index + (room.reveal ? 1 : 0)) / room.total) * 100)}% مكتمل</span>
        </div>
      </div>

      {/* أدوات التحكم */}
      <div className="flex flex-wrap items-center gap-2 rounded-3xl bg-white p-4 shadow">
        <span className="rounded-full bg-turq-100 px-3 py-1 text-sm font-bold text-turq-800">
          البطاقة {room.index + 1} / {room.total}
        </span>
        {!room.started && !room.finished && (
          <Btn size="sm" variant="success" onClick={() => act("start")} disabled={busy} className="animate-pulse">
            ▶️ بدء المسابقة الآن
          </Btn>
        )}
        {room.started && (
          <>
            <span className="flex items-center gap-1 text-xs font-bold text-slate-500">⏱️</span>
            {[0, 15, 20, 30, 45, 60].map((v) => (
              <button
                key={v}
                onClick={() => act("setSeconds", { seconds: v })}
                disabled={busy}
                className={cx(
                  "rounded-lg px-2 py-1 text-xs font-bold transition-colors",
                  room.seconds === v ? "bg-turq-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {v === 0 ? "بلا" : v}
              </button>
            ))}
          </>
        )}
        <Btn size="sm" variant="success" onClick={() => act("reveal")} disabled={busy || room.reveal || room.finished}>
          ✅ إظهار الإجابة الصحيحة
        </Btn>
        <Btn size="sm" variant="warning" onClick={() => act("next")} disabled={busy || room.finished}>
          ⏭️ البطاقة التالية
        </Btn>
        <Btn size="sm" variant="secondary" onClick={() => confirm("بدء جولة جديدة وتصفير النقاط؟") && act("reset")} disabled={busy}>
          🔄 جولة جديدة
        </Btn>
        <Btn size="sm" variant="danger" onClick={() => confirm("إغلاق المسابقة وإنهاء انضمام الطلاب؟") && act("close")} disabled={busy} className="ms-auto">
          ⏹️ إغلاق
        </Btn>
      </div>

      {/* البطاقة الحالية */}
      {room.card && (
        <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
          <p className="text-sm font-bold text-slate-500">{room.reveal ? "الإجابة الصحيحة:" : "البطاقة المعروضة على أجهزة الطلاب:"}</p>
          <p className="my-4 rounded-3xl bg-gradient-to-l from-turq-50 to-sky-50 p-6 text-3xl font-black leading-relaxed text-turq-900 md:text-4xl">{room.card.label}</p>
          {room.reveal ? (
            <p className="text-2xl font-black text-emerald-700">✓ {zoneLabel(room.card.zone)}</p>
          ) : (
            <p className="text-sm text-slate-500">اضغط «إظهار الإجابة الصحيحة» بعد إجابة الطلاب.</p>
          )}
        </div>
      )}

      {room.finished && (
        <div className="rounded-3xl bg-emerald-50 p-6 text-center shadow">
          <div className="text-5xl">🏁</div>
          <p className="mt-2 text-xl font-black text-emerald-800">انتهت جميع البطاقات — تهانينا للفائزين!</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* إجابات الطلاب */}
        <section className="rounded-3xl bg-white p-5 shadow">
          <h3 className="mb-3 text-lg font-black text-turq-900">إجابات الطلاب ({answered}/{room.players.length})</h3>
          {room.players.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-center text-slate-500">لم ينضم أحد بعد… اعرض الرمز على الطلاب.</p>
          ) : (
            <ul className="space-y-2">
              {room.players.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 p-2 text-sm">
                  <span className="font-bold text-slate-800">{p.name}</span>
                  {p.answered ? (
                    room.reveal ? (
                      <span className={cx("rounded-full px-2 py-0.5 text-xs font-bold", p.correct ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700")}>
                        {zoneLabel(p.choice)} {p.correct ? "✓" : "✗"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">أجاب ✓</span>
                    )
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">يفكّر…</span>
                  )}
                  <span className="ms-auto font-black text-brand-orange">{p.score}</span>
                  <button
                    onClick={() => act("kick", { playerId: p.id })}
                    className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700"
                    title="إخراج الطالب"
                  >
                    إخراج
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* الترتيب */}
        <section className="rounded-3xl bg-white p-5 shadow">
          <h3 className="mb-3 text-lg font-black text-turq-900">🏆 لوحة الترتيب</h3>
          {room.players.length === 0 ? (
            <p className="text-sm text-slate-500">لا توجد نتائج بعد.</p>
          ) : (
            <ol className="space-y-2">
              {[...room.players]
                .sort((a, b) => b.score - a.score)
                .map((p, i) => (
                  <li key={p.id} className={cx("flex items-center justify-between rounded-2xl px-3 py-2 font-bold", i === 0 ? "bg-amber-100 text-amber-900" : "bg-slate-50")}>
                    <span>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`} {p.name}
                    </span>
                    <span className="text-brand-orange">{p.score}</span>
                  </li>
                ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
