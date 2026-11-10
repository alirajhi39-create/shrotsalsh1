import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { ensureSeeded } from "./seed";
import { shuffledDeck, type QuizCard, type RoomMode } from "./rooms";
import { MEDIA_BY_KEY } from "./media-catalog";

/**
 * بنك أسئلة المسابقة: يدمج أسئلة الكتاب (النشاطات) + أسئلة الكتاب والتقويم من قاعدة
 * البيانات التي يديرها المعلم + بطاقات مواضع النجاسة، ثم يزججها.
 *
 * أنواع الأسئلة المدعومة في المسابقة:
 *  - classify : تصنيف موقف تحت شرط/موضع (خيارات = المناطق)
 *  - mcq      : اختيار من متعدد (options.choices + answer.index)
 */

export type LiveQuestion = {
  id: string;
  kind: "classify" | "mcq";
  label: string;               // نص البطاقة/السؤال
  correct: string;             // معرف المنطقة الصحيحة أو نص الخيار الصحيح
  options: { id: string; label: string; emoji?: string }[];
  source: "book" | "activity" | "custom";
};

function classifyQuestions(mode: RoomMode): LiveQuestion[] {
  return shuffledDeck(mode).map((c: QuizCard) => ({
    id: c.id,
    kind: "classify" as const,
    label: c.label,
    correct: c.zone,
    options: [], // تُبنى في الواجهة من قائمة المناطق
    source: "activity" as const,
  }));
}

/** يحوّل أسئلة قاعدة البيانات إلى أسئلة مسابقة قابلة للعب */
function fromDbRows(
  rows: { id: number; kind: string; prompt: string; options: Record<string, unknown>; answer: Record<string, unknown>; skill: string }[],
): LiveQuestion[] {
  const out: LiveQuestion[] = [];
  for (const q of rows) {
    const choices = Array.isArray(q.options?.choices) ? (q.options.choices as string[]) : [];
    if (["mcq", "situation", "fill"].includes(q.kind) && choices.length >= 2) {
      const idx = Number(q.answer?.index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= choices.length) continue;
      out.push({
        id: `q${q.id}`,
        kind: "mcq",
        label: q.prompt,
        correct: choices[idx],
        options: choices.map((c, i) => ({ id: c, label: c, emoji: ["🅰️", "🅱️", "🅲", "🅳"][i] })),
        source: "book",
      });
    }
  }
  return out;
}

/** يبني مجموعة أسئلة المسابقة ويخلطها */
export async function buildLiveDeck(mode: RoomMode, teacherId: number, opts?: { includeBook?: boolean }): Promise<LiveQuestion[]> {
  const includeBook = opts?.includeBook ?? true;
  const base = classifyQuestions(mode);

  if (!includeBook) return base;

  try {
    const lessonId = await ensureSeeded();
    const rows = await db
      .select({
        id: questions.id,
        kind: questions.kind,
        prompt: questions.prompt,
        options: questions.options,
        answer: questions.answer,
        skill: questions.skill,
      })
      .from(questions)
      .where(and(eq(questions.lessonId, lessonId), eq(questions.active, true)));

    const fromBook = fromDbRows(rows);
    // ندمج ونخلط: بطاقات التصنيف + أسئلة الكتاب/التقويم المفعّلة
    const merged = [...base, ...fromBook];
    for (let i = merged.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [merged[i], merged[j]] = [merged[j], merged[i]];
    }
    return merged;
  } catch {
    return base;
  }
}

export function zonesForQuestion(q: LiveQuestion, mode: RoomMode) {
  if (q.kind === "classify") {
    return mode === "conditions"
      ? ["islam", "tamyeez", "aql", "tahara", "najasa", "awrah"]
      : ["body", "clothes", "place"];
  }
  return q.options.map((o) => o.id);
}

export function zoneMeta(id: string) {
  const emo = ({ islam: "🕌", tamyeez: "🧒", aql: "🧠", tahara: "💧", najasa: "🧼", awrah: "👕", body: "🙋", clothes: "👕", place: "🧎" })[id];
  return { id, emoji: emo ?? "🔤" };
}

export { MEDIA_BY_KEY };
