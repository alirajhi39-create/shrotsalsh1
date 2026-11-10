"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------------ */
/*  النطق والأصوات                                                      */
/* ------------------------------------------------------------------ */

export function useSpeech() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking, setSpeaking] = useState(false);
  const speak = useCallback(
    (text: string) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ar-SA";
      u.rate = 0.9;
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("ar"));
      if (voice) u.voice = voice;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    },
    [supported],
  );
  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);
  return { speak, stop, speaking, supported };
}

export function useSounds(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const tone = useCallback(
    (notes: [number, number][], type: OscillatorType = "sine") => {
      if (!enabled || typeof window === "undefined") return;
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctxRef.current = ctxRef.current ?? new AC();
        const ctx = ctxRef.current;
        let t = ctx.currentTime;
        for (const [freq, dur] of notes) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = type;
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g).connect(ctx.destination);
          o.start(t);
          o.stop(t + dur);
          t += dur * 0.85;
        }
      } catch {
        /* تجاهل */
      }
    },
    [enabled],
  );
  return {
    success: () => tone([[523, 0.12], [659, 0.12], [784, 0.2]]),
    error: () => tone([[220, 0.18], [180, 0.22]], "triangle"),
    click: () => tone([[880, 0.05]]),
    fanfare: () => tone([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.3], [784, 0.12], [1047, 0.4]]),
  };
}

/* ------------------------------------------------------------------ */
/*  عناصر عامة                                                          */
/* ------------------------------------------------------------------ */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "success" | "warning" | "ghost" | "danger";
  size?: "md" | "lg" | "sm";
};

export function Btn({ variant = "primary", size = "md", className, ...rest }: BtnProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-turq-300 touch-target";
  const sizes = { sm: "px-4 py-2 text-sm min-h-10", md: "px-6 py-3 text-base", lg: "px-8 py-4 text-xl" };
  const variants = {
    primary: "bg-turq-500 text-white shadow-lg shadow-turq-500/30 hover:bg-turq-600",
    secondary: "bg-white text-turq-700 border-2 border-turq-200 hover:border-turq-400",
    success: "bg-brand-green text-white shadow-lg shadow-emerald-500/30 hover:brightness-110",
    warning: "bg-brand-orange text-white shadow-lg shadow-orange-500/30 hover:brightness-110",
    ghost: "bg-transparent text-turq-700 hover:bg-turq-50",
    danger: "bg-rose-500 text-white hover:bg-rose-600",
  };
  return <button className={cx(base, sizes[size], variants[variant], className)} {...rest} />;
}

export function Feedback({ kind, children }: { kind: "correct" | "wrong" | "info" | "pending"; children: ReactNode }) {
  const styles = {
    correct: "bg-emerald-50 border-emerald-300 text-emerald-900",
    wrong: "bg-rose-50 border-rose-300 text-rose-900",
    info: "bg-sky-50 border-sky-300 text-sky-900",
    pending: "bg-amber-50 border-amber-300 text-amber-900",
  };
  const icons = { correct: "🎉", wrong: "🤔", info: "💡", pending: "⏳" };
  return (
    <div role="status" className={cx("animate-pop rounded-2xl border-2 p-4 text-lg font-semibold leading-relaxed", styles[kind])}>
      <span className="me-2 text-2xl">{icons[kind]}</span>
      {children}
    </div>
  );
}

export function Stars({ count, total = 3 }: { count: number; total?: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${count} من ${total} نجوم`}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={cx("text-3xl transition-transform", i < count ? "scale-110 drop-shadow" : "opacity-30 grayscale")}>
          ⭐
        </span>
      ))}
    </div>
  );
}

export function ScoreBadge({ score, max }: { score: number; max: number }) {
  const pct = max ? Math.round((score / max) * 100) : 0;
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-bold text-turq-800 shadow">
      <span>{score}</span>
      <span className="text-slate-400">/</span>
      <span>{max}</span>
      <span className={cx("rounded-full px-2 py-0.5 text-xs text-white", pct >= 80 ? "bg-brand-green" : pct >= 50 ? "bg-brand-orange" : "bg-rose-500")}>
        {pct}%
      </span>
    </div>
  );
}

export function StationShell({
  emoji,
  title,
  subtitle,
  strategy,
  children,
  onSpeak,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  strategy?: string;
  children: ReactNode;
  onSpeak?: () => void;
}) {
  return (
    <section className="animate-fadeup">
      <header className="mb-6 flex flex-wrap items-center gap-4 rounded-3xl bg-white/80 p-5 shadow-lg shadow-turq-900/5 backdrop-blur">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-turq-400 to-brand-blue text-4xl shadow-inner">
          {emoji}
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-black text-turq-900 md:text-3xl">{title}</h2>
          {subtitle && <p className="text-turq-700">{subtitle}</p>}
        </div>
        {strategy && (
          <span className="rounded-full bg-brand-orange/15 px-4 py-2 text-sm font-bold text-orange-700">
            الاستراتيجية: {strategy}
          </span>
        )}
        {onSpeak && (
          <button
            onClick={onSpeak}
            className="touch-target rounded-2xl bg-turq-50 px-4 text-2xl text-turq-700 hover:bg-turq-100"
            aria-label="استمع"
            title="استمع"
          >
            🔊
          </button>
        )}
      </header>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-3xl bg-white p-6 shadow-lg shadow-turq-900/5", className)}>{children}</div>;
}

export function Confetti({ show }: { show: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }).map((_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        color: ["#1fadab", "#f7931e", "#22a06b", "#1e6fd9", "#facc15", "#f472b6"][i % 6],
        size: 8 + Math.random() * 10,
        rotate: Math.random() * 360,
      })),
    [],
  );
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 block animate-fall rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  الاختيار من متعدد                                                   */
/* ------------------------------------------------------------------ */

export function Choices({
  choices,
  value,
  onChange,
  correct,
  revealed,
  disabled,
  columns = 1,
}: {
  choices: readonly string[];
  value: number | null | undefined;
  onChange: (i: number) => void;
  correct?: number;
  revealed?: boolean;
  disabled?: boolean;
  columns?: 1 | 2 | 3;
}) {
  const letters = ["أ", "ب", "ج", "د", "هـ"];
  return (
    <div className={cx("grid gap-3", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}>
      {choices.map((c, i) => {
        const selected = value === i;
        const isCorrect = revealed && correct === i;
        const isWrong = revealed && selected && correct !== i;
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onChange(i)}
            className={cx(
              "touch-target flex items-center gap-3 rounded-2xl border-2 p-4 text-start text-lg font-semibold transition-all",
              "focus:outline-none focus-visible:ring-4 focus-visible:ring-turq-300",
              !revealed && !selected && "border-slate-200 bg-white hover:border-turq-300 hover:bg-turq-50",
              !revealed && selected && "border-turq-500 bg-turq-50 shadow-md",
              isCorrect && "border-emerald-500 bg-emerald-50",
              isWrong && "animate-wiggle border-rose-400 bg-rose-50",
              revealed && !isCorrect && !isWrong && "border-slate-200 bg-white opacity-70",
              disabled && "cursor-default",
            )}
          >
            <span
              className={cx(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full font-black",
                isCorrect ? "bg-emerald-500 text-white" : isWrong ? "bg-rose-500 text-white" : selected ? "bg-turq-500 text-white" : "bg-slate-100 text-slate-600",
              )}
            >
              {isCorrect ? "✓" : isWrong ? "✗" : letters[i]}
            </span>
            <span>{c}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TrueFalse({
  value,
  onChange,
  correct,
  revealed,
  disabled,
}: {
  value: boolean | null | undefined;
  onChange: (v: boolean) => void;
  correct?: boolean;
  revealed?: boolean;
  disabled?: boolean;
}) {
  const opts: { v: boolean; label: string; emoji: string }[] = [
    { v: true, label: "صح", emoji: "✅" },
    { v: false, label: "خطأ", emoji: "❌" },
  ];
  return (
    <div className="grid grid-cols-2 gap-4">
      {opts.map((o) => {
        const selected = value === o.v;
        const isCorrect = revealed && correct === o.v;
        const isWrong = revealed && selected && correct !== o.v;
        return (
          <button
            key={o.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.v)}
            className={cx(
              "touch-target rounded-2xl border-2 p-5 text-2xl font-black transition-all",
              !revealed && !selected && "border-slate-200 bg-white hover:border-turq-300",
              !revealed && selected && "border-turq-500 bg-turq-50",
              isCorrect && "border-emerald-500 bg-emerald-50",
              isWrong && "animate-wiggle border-rose-400 bg-rose-50",
            )}
          >
            <span className="me-2">{o.emoji}</span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function MultiChoices({
  choices,
  value,
  onChange,
  correct,
  revealed,
  disabled,
}: {
  choices: readonly string[];
  value: number[];
  onChange: (v: number[]) => void;
  correct?: number[];
  revealed?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {choices.map((c, i) => {
        const selected = value.includes(i);
        const isCorrect = revealed && correct?.includes(i);
        const isWrong = revealed && selected && !correct?.includes(i);
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onChange(selected ? value.filter((v) => v !== i) : [...value, i])}
            className={cx(
              "touch-target flex items-center gap-3 rounded-2xl border-2 p-4 text-start text-lg font-semibold transition-all",
              !revealed && !selected && "border-slate-200 bg-white hover:border-turq-300",
              !revealed && selected && "border-turq-500 bg-turq-50",
              isCorrect && "border-emerald-500 bg-emerald-50",
              isWrong && "border-rose-400 bg-rose-50",
            )}
          >
            <span
              className={cx(
                "grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 text-base font-black",
                selected || isCorrect ? "border-turq-500 bg-turq-500 text-white" : "border-slate-300 bg-white",
                isCorrect && "border-emerald-500 bg-emerald-500",
                isWrong && "border-rose-500 bg-rose-500",
              )}
            >
              {selected || isCorrect ? "✓" : ""}
            </span>
            {c}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ترتيب الكلمات                                                       */
/* ------------------------------------------------------------------ */

export function OrderWords({
  words,
  value,
  onChange,
  disabled,
  status,
}: {
  words: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  status?: "correct" | "wrong" | null;
}) {
  const remaining = useMemo(() => {
    const used = [...value];
    return words.filter((w) => {
      const i = used.indexOf(w);
      if (i >= 0) {
        used.splice(i, 1);
        return false;
      }
      return true;
    });
  }, [words, value]);
  return (
    <div className="space-y-4">
      <div
        className={cx(
          "flex min-h-20 flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed p-3",
          status === "correct" ? "border-emerald-400 bg-emerald-50" : status === "wrong" ? "border-rose-300 bg-rose-50" : "border-turq-300 bg-turq-50/50",
        )}
        aria-label="الجملة المرتبة"
      >
        {value.length === 0 && <span className="text-slate-400">اضغط على الكلمات بالترتيب الصحيح…</span>}
        {value.map((w, i) => (
          <button
            key={`${w}-${i}`}
            type="button"
            disabled={disabled}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="touch-target animate-pop rounded-xl bg-turq-600 px-4 py-2 text-lg font-bold text-white shadow"
          >
            {w}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {remaining.map((w, i) => (
          <button
            key={`${w}-${i}`}
            type="button"
            disabled={disabled}
            onClick={() => onChange([...value, w])}
            className="touch-target rounded-xl border-2 border-turq-200 bg-white px-4 py-2 text-lg font-bold text-turq-800 shadow-sm hover:border-turq-400 hover:bg-turq-50"
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  السحب والإفلات (يدعم اللمس عبر النقر للاختيار ثم النقر على المنطقة)   */
/* ------------------------------------------------------------------ */

export type DnDItem = { id: string; label: string; emoji?: string };
export type DnDZone = { id: string; label: string; emoji?: string; color?: string };

export function DragZones({
  items,
  zones,
  value,
  onChange,
  results,
  disabled,
  zoneColumns = 3,
}: {
  items: readonly DnDItem[];
  zones: readonly DnDZone[];
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  results?: Record<string, boolean>;
  disabled?: boolean;
  zoneColumns?: 2 | 3;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const pool = items.filter((it) => !value[it.id]);

  const place = (itemId: string, zoneId: string) => {
    if (disabled) return;
    onChange({ ...value, [itemId]: zoneId });
    setSelected(null);
  };
  const unplace = (itemId: string) => {
    if (disabled) return;
    const next = { ...value };
    delete next[itemId];
    onChange(next);
  };

  const ItemChip = ({ it, placed }: { it: DnDItem; placed?: boolean }) => {
    const r = results?.[it.id];
    return (
      <button
        type="button"
        draggable={!disabled}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", it.id);
          setSelected(it.id);
        }}
        onDragEnd={() => setSelected(null)}
        onClick={() => (placed ? unplace(it.id) : setSelected(selected === it.id ? null : it.id))}
        disabled={disabled && !placed}
        className={cx(
          "touch-target flex cursor-grab items-center gap-2 rounded-xl border-2 px-3 py-2 text-start text-base font-bold shadow-sm transition-all active:cursor-grabbing",
          selected === it.id && "scale-105 border-brand-orange bg-orange-50 ring-4 ring-orange-200",
          selected !== it.id && r === undefined && "border-turq-200 bg-white hover:border-turq-400",
          r === true && "border-emerald-500 bg-emerald-50",
          r === false && "animate-wiggle border-rose-400 bg-rose-50",
        )}
      >
        {it.emoji && <span className="text-2xl">{it.emoji}</span>}
        <span>{it.label}</span>
        {r === true && <span className="ms-auto text-emerald-600">✓</span>}
        {r === false && <span className="ms-auto text-rose-600">✗</span>}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-3">
        <p className="mb-2 text-sm font-bold text-slate-500">
          {pool.length ? "اسحب البطاقة إلى مكانها الصحيح، أو اضغط عليها ثم اضغط على المكان" : "أحسنت! وزّعت جميع البطاقات"}
        </p>
        <div className="flex flex-wrap gap-2">
          {pool.map((it) => (
            <ItemChip key={it.id} it={it} />
          ))}
        </div>
      </div>
      <div className={cx("grid gap-4", zoneColumns === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
        {zones.map((z) => {
          const inZone = items.filter((it) => value[it.id] === z.id);
          return (
            <div
              key={z.id}
              role="button"
              tabIndex={0}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(z.id);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || selected;
                setOver(null);
                if (id) place(id, z.id);
              }}
              onClick={() => selected && place(selected, z.id)}
              onKeyDown={(e) => e.key === "Enter" && selected && place(selected, z.id)}
              className={cx(
                "min-h-36 rounded-3xl border-4 p-3 transition-all",
                over === z.id || selected ? "border-brand-orange bg-orange-50/60" : "border-turq-200 bg-white",
                z.color,
              )}
            >
              <div className="mb-2 flex items-center justify-center gap-2 rounded-2xl bg-turq-600 py-2 text-lg font-black text-white">
                {z.emoji && <span className="text-2xl">{z.emoji}</span>}
                {z.label}
              </div>
              <div className="flex flex-col gap-2">
                {inZone.map((it) => (
                  <ItemChip key={it.id} it={it} placed />
                ))}
                {inZone.length === 0 && <p className="py-3 text-center text-sm text-slate-400">أفلت هنا</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  المطابقة                                                            */
/* ------------------------------------------------------------------ */

const PAIR_COLORS = ["bg-teal-500", "bg-sky-500", "bg-indigo-500", "bg-cyan-600", "bg-emerald-500", "bg-orange-500"];

export function MatchPairs({
  left,
  right,
  value,
  onChange,
  results,
  disabled,
}: {
  left: readonly DnDItem[];
  right: readonly DnDItem[];
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  results?: Record<string, boolean>;
  disabled?: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  const colorOf = (leftId: string) => PAIR_COLORS[left.findIndex((l) => l.id === leftId) % PAIR_COLORS.length];
  const leftOfRight = (rightId: string) => Object.entries(value).find(([, r]) => r === rightId)?.[0];

  const pick = (rightId: string) => {
    if (disabled || !active) return;
    const next = { ...value };
    for (const k of Object.keys(next)) if (next[k] === rightId) delete next[k];
    next[active] = rightId;
    onChange(next);
    setActive(null);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <p className="text-sm font-bold text-slate-500">١) اضغط على الشرط</p>
        {left.map((l) => {
          const r = results?.[l.id];
          return (
            <button
              key={l.id}
              type="button"
              disabled={disabled}
              onClick={() => setActive(active === l.id ? null : l.id)}
              className={cx(
                "touch-target flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-start text-lg font-bold transition-all",
                active === l.id ? "scale-[1.02] border-brand-orange bg-orange-50 ring-4 ring-orange-200" : "border-slate-200 bg-white",
                r === true && "border-emerald-500 bg-emerald-50",
                r === false && "border-rose-400 bg-rose-50",
              )}
            >
              <span className={cx("h-4 w-4 rounded-full", value[l.id] ? colorOf(l.id) : "bg-slate-200")} />
              {l.emoji && <span className="text-2xl">{l.emoji}</span>}
              {l.label}
              {r === true && <span className="ms-auto text-emerald-600">✓</span>}
              {r === false && <span className="ms-auto text-rose-600">✗</span>}
            </button>
          );
        })}
      </div>
      <div className="space-y-3">
        <p className="text-sm font-bold text-slate-500">٢) ثم اضغط على معناه</p>
        {right.map((r) => {
          const owner = leftOfRight(r.id);
          return (
            <button
              key={r.id}
              type="button"
              disabled={disabled}
              onClick={() => pick(r.id)}
              className={cx(
                "touch-target flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-start text-base font-semibold transition-all",
                active ? "border-turq-400 bg-turq-50 hover:bg-turq-100" : "border-slate-200 bg-white",
              )}
            >
              <span className={cx("h-4 w-4 shrink-0 rounded-full", owner ? colorOf(owner) : "bg-slate-200")} />
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  البطاقة القلابة                                                     */
/* ------------------------------------------------------------------ */

export function FlipCard({
  flipped,
  onFlip,
  front,
  back,
  className,
}: {
  flipped: boolean;
  onFlip: () => void;
  front: ReactNode;
  back: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flip-scene h-64", className)}>
      <button
        type="button"
        onClick={onFlip}
        className={cx("flip-card h-full w-full text-start focus:outline-none focus-visible:ring-4 focus-visible:ring-turq-300 rounded-3xl", flipped && "flipped")}
        aria-pressed={flipped}
      >
        <div className="flip-face rounded-3xl">{front}</div>
        <div className="flip-face flip-back rounded-3xl">{back}</div>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  المسجل الصوتي                                                       */
/* ------------------------------------------------------------------ */

export function AudioRecorder({
  onSave,
  disabled,
  saved,
  maxSeconds = 60,
}: {
  onSave: (data: { dataBase64: string; mimeType: string; durationMs: number }) => Promise<unknown> | void;
  disabled?: boolean;
  saved?: boolean;
  maxSeconds?: number;
}) {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const supported = typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices;

  const stop = useCallback(() => {
    recRef.current?.stop();
    setRecording(false);
    if (timer.current) clearInterval(timer.current);
  }, []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = () => {
        const b = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
        setBlob(b);
        setUrl(URL.createObjectURL(b));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      recRef.current = mr;
      startRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      timer.current = setInterval(() => {
        const s = Math.floor((Date.now() - startRef.current) / 1000);
        setElapsed(s);
        if (s >= maxSeconds) stop();
      }, 250);
    } catch {
      setError("تعذر الوصول إلى الميكروفون. تأكد من السماح للمتصفح باستخدامه.");
    }
  };

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const save = async () => {
    if (!blob) return;
    setBusy(true);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(",")[1] ?? "");
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(blob);
      });
      await onSave({ dataBase64: b64, mimeType: blob.type || "audio/webm", durationMs: elapsed * 1000 });
      setBlob(null);
      setUrl(null);
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return <p className="text-sm text-slate-500">التسجيل الصوتي غير مدعوم في هذا المتصفح.</p>;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-3">
      {!recording ? (
        <Btn type="button" variant="secondary" onClick={start} disabled={disabled || busy}>
          🎙️ {blob ? "إعادة التسجيل" : "ابدأ التسجيل"}
        </Btn>
      ) : (
        <Btn type="button" variant="danger" onClick={stop}>
          ⏹️ إيقاف ({elapsed} ث)
        </Btn>
      )}
      {url && <audio controls src={url} className="h-10 max-w-full" />}
      {blob && (
        <Btn type="button" variant="success" onClick={save} disabled={busy}>
          {busy ? "جارٍ الحفظ…" : "💾 حفظ التسجيل"}
        </Btn>
      )}
      {saved && !blob && <span className="font-bold text-emerald-700">✓ تم حفظ تسجيلك</span>}
      {error && <span className="text-sm text-rose-600">{error}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  مشغل الفيديو                                                        */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: string | HTMLElement,
        opts: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: { onStateChange?: (e: { data: number }) => void };
        },
      ) => { destroy: () => void };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export function youTubeId(url: string): string | null {
  const m =
    url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{6,})/) ??
    url.match(/[?&]v=([\w-]{6,})/);
  return m ? m[1] : null;
}

export function VideoPlayer({ url, onEnded }: { url: string; onEnded: () => void }) {
  const id = useMemo(() => youTubeId(url), [url]);
  const holder = useRef<HTMLDivElement>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;

  useEffect(() => {
    if (!id || !holder.current) return;
    let player: { destroy: () => void } | null = null;
    const el = document.createElement("div");
    holder.current.innerHTML = "";
    holder.current.appendChild(el);
    const create = () => {
      if (!window.YT) return;
      player = new window.YT.Player(el, {
        videoId: id,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: { onStateChange: (e) => e.data === 0 && endedRef.current() },
      });
    };
    if (window.YT?.Player) create();
    else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        create();
      };
      if (!document.getElementById("yt-iframe-api")) {
        const s = document.createElement("script");
        s.id = "yt-iframe-api";
        s.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(s);
      }
    }
    return () => {
      try {
        player?.destroy();
      } catch {
        /* تجاهل */
      }
    };
  }, [id]);

  if (id) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-3xl bg-black shadow-xl [&_iframe]:h-full [&_iframe]:w-full">
        <div ref={holder} className="h-full w-full" />
      </div>
    );
  }
  if (/\.(mp4|webm|ogg|m3u8)(\?|$)/i.test(url)) {
    return (
      <video controls playsInline onEnded={onEnded} className="aspect-video w-full rounded-3xl bg-black shadow-xl" src={url} />
    );
  }
  return (
    <iframe
      src={url}
      className="aspect-video w-full rounded-3xl bg-black shadow-xl"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
      title="فيديو الدرس"
    />
  );
}

export function PrintButton({ label = "🖨️ طباعة / حفظ PDF", className }: { label?: string; className?: string }) {
  return (
    <Btn type="button" variant="primary" className={cx("no-print", className)} onClick={() => window.print()}>
      {label}
    </Btn>
  );
}
