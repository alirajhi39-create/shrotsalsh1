"use client";

import { useMemo, useState } from "react";
import { CLASSIFY_CARDS, CONDITIONS, NAJASA_CARDS, NAJASA_PLACES } from "@/lib/content";
import { Btn, Confetti, cx, shuffle, useSounds } from "@/components/lesson/ui";

type Mode = "conditions" | "najasa";

export default function BoardGame() {
  const [mode, setMode] = useState<Mode>("conditions");
  const [round, setRound] = useState(0);
  const sounds = useSounds(true);
  const [team, setTeam] = useState<0 | 1>(0);
  const [scores, setScores] = useState([0, 0]);
  const [teamNames, setTeamNames] = useState(["الفريق الأخضر", "الفريق البرتقالي"]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [log, setLog] = useState<{ card: string; zone: string; ok: boolean; team: number }[]>([]);
  const [confetti, setConfetti] = useState(false);

  const deck = useMemo(() => {
    const src: { id: string; label: string; zone: string }[] =
      mode === "conditions"
        ? CLASSIFY_CARDS.map((c) => ({ id: c.id, label: c.label, zone: c.zone }))
        : NAJASA_CARDS.map((c) => ({ id: c.id, label: `${c.emoji} ${c.label}`, zone: c.zone }));
    return shuffle(src);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, round]);
  const zones = mode === "conditions" ? CONDITIONS.map((c) => ({ id: c.key, label: c.name, emoji: c.icon })) : NAJASA_PLACES.map((p) => ({ id: p.key, label: p.label, emoji: p.icon }));
  const card = deck[idx];
  const finished = idx >= deck.length;

  const choose = (zoneId: string) => {
    if (!card || picked) return;
    const ok = zoneId === card.zone;
    setPicked(zoneId);
    ok ? sounds.success() : sounds.error();
    setScores((s) => s.map((v, i) => (i === team && ok ? v + 1 : v)));
    setLog((l) => [...l, { card: card.label, zone: zones.find((z) => z.id === zoneId)?.label ?? zoneId, ok, team }]);
    setTimeout(() => {
      setPicked(null);
      setIdx((i) => i + 1);
      setTeam((t) => (t === 0 ? 1 : 0));
      if (idx + 1 >= deck.length) {
        setConfetti(true);
        sounds.fanfare();
        setTimeout(() => setConfetti(false), 3500);
      }
    }, 1400);
  };

  const reset = () => {
    setRound((r) => r + 1);
    setIdx(0);
    setScores([0, 0]);
    setLog([]);
    setTeam(0);
    setPicked(null);
  };

  return (
    <div className="space-y-5">
      <Confetti show={confetti} />
      <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-white p-4 shadow">
        <span className="font-black text-turq-900">النشاط:</span>
        <Btn variant={mode === "conditions" ? "primary" : "secondary"} size="sm" onClick={() => { setMode("conditions"); reset(); }}>
          🗂️ صنّف الشروط الستة
        </Btn>
        <Btn variant={mode === "najasa" ? "primary" : "secondary"} size="sm" onClick={() => { setMode("najasa"); reset(); }}>
          🧼 مواضع إزالة النجاسة
        </Btn>
        <Btn variant="ghost" size="sm" onClick={reset} className="ms-auto">
          🔄 جولة جديدة
        </Btn>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {teamNames.map((n, i) => (
          <div key={i} className={cx("flex items-center gap-3 rounded-3xl border-4 p-4 transition-all", team === i && !finished ? (i === 0 ? "border-emerald-400 bg-emerald-50" : "border-orange-400 bg-orange-50") : "border-transparent bg-white")}>
            <input value={n} onChange={(e) => setTeamNames((t) => t.map((x, j) => (j === i ? e.target.value : x)))} className="w-full bg-transparent text-xl font-black text-slate-800 focus:outline-none" aria-label="اسم الفريق" />
            <span className="text-4xl font-black text-turq-900">{scores[i]}</span>
            {team === i && !finished && <span className="rounded-full bg-white px-3 py-1 text-sm font-bold shadow">دوركم ▶</span>}
          </div>
        ))}
      </div>

      {!finished && card ? (
        <div className="rounded-3xl bg-white p-6 shadow-xl">
          <p className="text-center text-sm font-bold text-slate-500">
            البطاقة {idx + 1} من {deck.length}
          </p>
          <p className="my-4 rounded-3xl bg-gradient-to-l from-turq-50 to-sky-50 p-6 text-center text-3xl font-black text-turq-900 md:text-4xl">{card.label}</p>
          <div className={cx("grid gap-3", zones.length === 3 ? "md:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3")}>
            {zones.map((z) => {
              const isPicked = picked === z.id;
              const isAnswer = picked && z.id === card.zone;
              return (
                <button
                  key={z.id}
                  onClick={() => choose(z.id)}
                  disabled={!!picked}
                  className={cx(
                    "touch-target rounded-3xl border-4 p-5 text-2xl font-black transition-all",
                    !picked && "border-turq-200 bg-white hover:border-turq-500 hover:bg-turq-50",
                    isAnswer && "border-emerald-500 bg-emerald-50 text-emerald-900",
                    isPicked && !isAnswer && "animate-wiggle border-rose-400 bg-rose-50 text-rose-900",
                    picked && !isPicked && !isAnswer && "opacity-50",
                  )}
                >
                  <span className="me-2 text-3xl">{z.emoji}</span>
                  {z.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="text-6xl">🏆</div>
          <h3 className="mt-2 text-3xl font-black text-turq-900">
            {scores[0] === scores[1] ? "تعادل رائع!" : `الفائز: ${scores[0] > scores[1] ? teamNames[0] : teamNames[1]}`}
          </h3>
          <p className="mt-2 text-lg text-slate-600">
            {teamNames[0]}: {scores[0]} — {teamNames[1]}: {scores[1]}
          </p>
          <Btn className="mt-4" size="lg" onClick={reset}>
            🔄 جولة جديدة
          </Btn>
        </div>
      )}

      {log.length > 0 && (
        <div className="rounded-3xl bg-white p-4 shadow">
          <h4 className="mb-2 font-black text-turq-900">سجل الجولة</h4>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {log.map((l, i) => (
              <li key={i} className={cx("rounded-xl px-3 py-1", l.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900")}>
                {l.ok ? "✓" : "✗"} {teamNames[l.team]}: «{l.card}» ← {l.zone}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
