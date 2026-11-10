/**
 * تصحيح أسئلة قاعدة البيانات (نشاط الكتاب + التقويم الختامي)
 * أنواع الأسئلة:
 *  - mcq / situation / fill : options.choices[] ، answer.index
 *  - truefalse               : answer.value (boolean)
 *  - multi                   : options.choices[] ، answer.indices[]
 *  - order                   : options.words[] ، answer.order[]
 *  - dragdrop                : options.items[] , options.zones[] ، answer.map {item: zone}
 *  - essay                   : answer.modelAnswer ، answer.keywords[] (تصحيح يدوي)
 */

export type QuestionKind = "mcq" | "situation" | "fill" | "truefalse" | "multi" | "order" | "dragdrop" | "essay";

export type GradeResult = {
  isCorrect: boolean | null;
  score: number;
  maxScore: number;
  needsReview: boolean;
};

export type GradableQuestion = {
  id: number;
  kind: string;
  points: number;
  options: Record<string, unknown>;
  answer: Record<string, unknown>;
};

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export const KIND_LABELS: Record<string, string> = {
  mcq: "اختيار من متعدد",
  situation: "سؤال موقف",
  fill: "إكمال فراغ",
  truefalse: "صح أو خطأ",
  multi: "اختر كل ما ينطبق",
  order: "ترتيب كلمات",
  dragdrop: "سحب وإفلات",
  essay: "سؤال كتابي",
};

export function gradeQuestion(q: GradableQuestion, response: unknown): GradeResult {
  const points = Math.max(1, q.points || 1);
  const r = rec(response);

  switch (q.kind) {
    case "mcq":
    case "situation":
    case "fill": {
      const ok = r.index !== undefined && Number(r.index) === Number(q.answer.index);
      return { isCorrect: ok, score: ok ? points : 0, maxScore: points, needsReview: false };
    }
    case "truefalse": {
      const ok = typeof r.value === "boolean" && r.value === Boolean(q.answer.value);
      return { isCorrect: ok, score: ok ? points : 0, maxScore: points, needsReview: false };
    }
    case "multi": {
      const correct = new Set((Array.isArray(q.answer.indices) ? q.answer.indices : []).map(Number));
      const chosen = new Set((Array.isArray(r.indices) ? r.indices : []).map(Number));
      let hits = 0;
      let misses = 0;
      chosen.forEach((i) => (correct.has(i) ? hits++ : misses++));
      const exact = hits === correct.size && misses === 0;
      const raw = correct.size ? (hits - misses) / correct.size : 0;
      const score = exact ? points : Math.max(0, Math.round(points * raw));
      return { isCorrect: exact, score, maxScore: points, needsReview: false };
    }
    case "order": {
      const correct = Array.isArray(q.answer.order) ? (q.answer.order as string[]) : [];
      const given = Array.isArray(r.order) ? (r.order as string[]) : [];
      const ok = correct.length > 0 && given.length === correct.length && given.every((w, i) => w === correct[i]);
      return { isCorrect: ok, score: ok ? points : 0, maxScore: points, needsReview: false };
    }
    case "dragdrop": {
      const key = rec(q.answer.map);
      const given = rec(r.map);
      const items = Object.keys(key);
      const hits = items.filter((k) => given[k] === key[k]).length;
      const exact = items.length > 0 && hits === items.length;
      const score = items.length ? Math.round((points * hits) / items.length) : 0;
      return { isCorrect: exact, score, maxScore: points, needsReview: false };
    }
    case "essay":
    default:
      return { isCorrect: null, score: 0, maxScore: points, needsReview: true };
  }
}

/** تحويل إجابة الطالب إلى نص مقروء للمعلم */
export function humanizeResponse(kind: string, options: Record<string, unknown>, response: unknown): string {
  const r = rec(response);
  const choices = Array.isArray(options.choices) ? (options.choices as string[]) : [];
  switch (kind) {
    case "mcq":
    case "situation":
    case "fill":
      return r.index !== undefined ? (choices[Number(r.index)] ?? String(r.index)) : "—";
    case "truefalse":
      return r.value === true ? "صح" : r.value === false ? "خطأ" : "—";
    case "multi":
      return Array.isArray(r.indices) ? (r.indices as number[]).map((i) => choices[i] ?? i).join("، ") : "—";
    case "order":
      return Array.isArray(r.order) ? (r.order as string[]).join(" ") : "—";
    case "dragdrop":
      return Object.entries(rec(r.map))
        .map(([k, v]) => `${k} ← ${v}`)
        .join("، ");
    case "essay":
      return typeof r.text === "string" ? r.text : "—";
    default:
      return JSON.stringify(response);
  }
}

/** تحويل إجابة نشاط محطة إلى نص مقروء */
export function humanizeActivityAnswer(answer: unknown): string {
  const r = rec(answer);
  if (typeof r.text === "string" && r.text.trim()) return r.text;
  if (Array.isArray(r.choices)) return (r.choices as string[]).join("، ");
  if (Array.isArray(r.order)) return (r.order as string[]).join(" ");
  if (r.audio === true) return "تسجيل صوتي";
  const entries = Object.entries(r).filter(([k]) => !["idempotencyKey"].includes(k));
  if (!entries.length) return "—";
  return entries.map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" | ");
}

export function summarizeSkills(
  items: { skill: string; earned: number; max: number }[],
): Record<string, { earned: number; max: number }> {
  const out: Record<string, { earned: number; max: number }> = {};
  for (const it of items) {
    const s = it.skill || "عام";
    out[s] = out[s] ?? { earned: 0, max: 0 };
    out[s].earned += it.earned;
    out[s].max += it.max;
  }
  return out;
}
