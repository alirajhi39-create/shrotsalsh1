"use client";

import { useMemo } from "react";
import type { QuestionView } from "@/lib/student";
import { Choices, DragZones, MultiChoices, OrderWords, TrueFalse, shuffle, cx } from "./ui";

export type Reveal = {
  isCorrect: boolean | null;
  score: number;
  maxScore: number;
  explanation?: string;
  needsReview?: boolean;
};

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export function QuestionRenderer({
  question,
  value,
  onChange,
  reveal,
  disabled,
  index,
}: {
  question: QuestionView;
  value: unknown;
  onChange: (v: unknown) => void;
  reveal?: Reveal | null;
  disabled?: boolean;
  index?: number;
}) {
  const v = rec(value);
  const opts = question.options;
  const choices = Array.isArray(opts.choices) ? (opts.choices as string[]) : [];
  const words = Array.isArray(opts.words) ? (opts.words as string[]) : [];
  const items = Array.isArray(opts.items) ? (opts.items as string[]) : [];
  const zones = Array.isArray(opts.zones) ? (opts.zones as string[]) : [];
  const revealed = !!reveal;
  const shuffledWords = useMemo(() => shuffle(words), [question.id]); // eslint-disable-line react-hooks/exhaustive-deps

  let body: React.ReactNode = null;
  switch (question.kind) {
    case "mcq":
    case "situation":
    case "fill":
      body = (
        <Choices
          choices={choices}
          value={typeof v.index === "number" ? v.index : null}
          onChange={(i) => onChange({ index: i })}
          revealed={revealed}
          correct={reveal?.isCorrect ? (v.index as number) : undefined}
          disabled={disabled}
          columns={choices.length === 2 ? 2 : 1}
        />
      );
      break;
    case "truefalse":
      body = (
        <TrueFalse
          value={typeof v.value === "boolean" ? v.value : null}
          onChange={(b) => onChange({ value: b })}
          revealed={revealed}
          correct={reveal?.isCorrect ? (v.value as boolean) : reveal ? !(v.value as boolean) : undefined}
          disabled={disabled}
        />
      );
      break;
    case "multi":
      body = (
        <MultiChoices
          choices={choices}
          value={Array.isArray(v.indices) ? (v.indices as number[]) : []}
          onChange={(arr) => onChange({ indices: arr })}
          revealed={revealed}
          correct={reveal?.isCorrect ? (v.indices as number[]) : undefined}
          disabled={disabled}
        />
      );
      break;
    case "order":
      body = (
        <OrderWords
          words={shuffledWords}
          value={Array.isArray(v.order) ? (v.order as string[]) : []}
          onChange={(arr) => onChange({ order: arr })}
          disabled={disabled}
          status={reveal ? (reveal.isCorrect ? "correct" : "wrong") : null}
        />
      );
      break;
    case "dragdrop": {
      const map = rec(v.map) as Record<string, string>;
      body = (
        <DragZones
          items={items.map((it) => ({ id: it, label: it }))}
          zones={zones.map((z) => ({ id: z, label: z }))}
          value={map}
          onChange={(m) => onChange({ map: m })}
          disabled={disabled}
          zoneColumns={zones.length === 2 ? 2 : 3}
          results={reveal ? Object.fromEntries(items.map((it) => [it, !!reveal.isCorrect])) : undefined}
        />
      );
      break;
    }
    case "essay":
    default:
      body = (
        <textarea
          value={typeof v.text === "string" ? v.text : ""}
          onChange={(e) => onChange({ text: e.target.value })}
          disabled={disabled}
          rows={4}
          placeholder="اكتب إجابتك هنا…"
          className="w-full rounded-2xl border-2 border-slate-200 p-4 text-lg leading-relaxed focus:border-turq-400 focus:outline-none disabled:bg-slate-50"
        />
      );
  }

  return (
    <div
      className={cx(
        "rounded-3xl border-2 bg-white p-5 shadow-sm transition-colors",
        reveal?.isCorrect === true && "border-emerald-300",
        reveal?.isCorrect === false && "border-rose-300",
        reveal?.isCorrect == null && "border-slate-100",
      )}
    >
      <div className="mb-4 flex flex-wrap items-start gap-3">
        {index !== undefined && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-turq-600 font-black text-white">{index}</span>
        )}
        <p className="flex-1 text-lg font-bold leading-relaxed text-slate-800">{question.prompt}</p>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
          {question.points} {question.points === 1 ? "درجة" : "درجات"}
        </span>
      </div>
      {body}
      {reveal && (
        <div
          className={cx(
            "mt-4 rounded-2xl p-3 text-base font-semibold",
            reveal.needsReview
              ? "bg-amber-50 text-amber-900"
              : reveal.isCorrect
                ? "bg-emerald-50 text-emerald-900"
                : "bg-rose-50 text-rose-900",
          )}
        >
          {reveal.needsReview ? (
            <>⏳ إجابتك محفوظة وسيصححها المعلم.</>
          ) : reveal.isCorrect ? (
            <>🎉 إجابة صحيحة! {reveal.explanation}</>
          ) : (
            <>
              🤔 إجابة غير صحيحة. {reveal.explanation && <span className="block mt-1">الصواب: {reveal.explanation}</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
