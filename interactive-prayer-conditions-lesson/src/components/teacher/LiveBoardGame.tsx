"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { teacherFetch } from "@/lib/client-auth";
import { Btn, Confetti, cx, useSounds } from "@/components/lesson/ui";

type Player = { id: string; name: string; score: number; answered: boolean; choice: string | null; correct: boolean };
type RoomState = {
  ok?: boolean;
  error?: string;
  code: string;
  mode: "conditions" | "najasa";
  index: number;
  total: number;
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
  const sounds = useSounds(true);
  const prevAnswered = useRef(0);
  const prevIndex = useRef(-1);

  const load = useCallback(async () => {
    if (!code) return;
    const res = await teacherFetch(`/api/teacher/room?code=${encodeURIComponent(code)}`);
    if (!res.ok) {
      setRoom(null);
      setCode(null);
      return;
    }
    const d = (await res.json()) as RoomState;
    setRoom(d);
    if (d.index !== prevIndex.current) {
      prevIndex.current = d.index;
      sounds.click();
    }
    const answered = d.players.filter((p) => p.answered).length;
    if (answered > prevAnswered.current) {
      sounds.click();
      prevAnswered.current = answered;
    }
  }, [code, sounds]);

  useEffect(() => {
    if (!code) return;
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [code, load]);

  const act = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      setBusy(true);
      try {
        const res = await teacherFetch("/api/teacher/room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, code, ...extra }),
        });
        const d = (await res.json()) as { ok?: boolean; code?: string; error?: string; finished?: boolean };
        if (!res.ok) return false;
        if (action === "create" && d.code) setCode(d.code);
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
    [code, load, sounds],
  );

  if (!code) {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl bg-gradient-to-l from-sky-50 to-white p-5">
          <h2 className="text-xl font-black text-turq-900">🎮 مسابقة مباشرة يشارك فيها الطلاب من أجهزتهم</h2>
          <p className="mt-2 leading-relaxed text-slate-700">
            اضغط «بدء مسابقة» ليظهر رمز من 4 أرقام على السبورة. يفتح الطلاب رابط <b>/play</b> على هواتهم، يدخلون الرمز وأسماءهم،
            ثم يجيب كل طالب بنفسه عن البطاقة المعروضة — وتظهر النتائج والترتيب على السبورة لحظيًا.
          </p>
          <p className="mt-2 text-sm font-bold text-brand-orange">
            نصيحة: اعرض الرابط <span className="font-mono">/play</span> مع الرمز على السبورة قبل البدء.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Btn size="lg" onClick={() => act("create", { mode: "conditions" })} disabled={busy}>
            🗂️ بدء مسابقة «صنّف الشروط»
          </Btn>
          <Btn size="lg" variant="warning" onClick={() => act("create", { mode: "najasa" })} disabled={busy}>
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
  const zoneLabel = (id: string | null) => room.zones.find((z) => z.id === id)?.label ?? "—";

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

      {/* أدوات التحكم */}
      <div className="flex flex-wrap items-center gap-2 rounded-3xl bg-white p-4 shadow">
        <span className="rounded-full bg-turq-100 px-3 py-1 text-sm font-bold text-turq-800">
          البطاقة {room.index + 1} / {room.total}
        </span>
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
          <p className="my-4 rounded-3xl bg-gradient-to-l from-turq-50 to-sky-50 p-6 text-3xl font-black text-turq-900 md:text-4xl">{room.card.label}</p>
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
                        {p.choice} {p.correct ? "✓" : "✗"}
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
