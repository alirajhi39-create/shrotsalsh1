"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KIND_LABELS } from "@/lib/grading";
import { SKILLS } from "@/lib/content";

export function ConfirmForm({
  action,
  message,
  children,
  className,
  hidden,
}: {
  action: (fd: FormData) => void | Promise<void>;
  message: string;
  children: ReactNode;
  className?: string;
  hidden: Record<string, string | number>;
}) {
  return (
    <form action={action} onSubmit={(e) => !confirm(message) && e.preventDefault()} className={className}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
    </form>
  );
}

export function FlashMessage() {
  const params = useSearchParams();
  const router = useRouter();
  const msg = params.get("msg");
  const error = params.get("error");
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    if (!msg && !error) return;
    const t = setTimeout(() => {
      setVisible(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("msg");
      url.searchParams.delete("error");
      router.replace(url.pathname + url.search);
    }, 6000);
    return () => clearTimeout(t);
  }, [msg, error, router]);
  if (!visible || (!msg && !error)) return null;
  const text =
    msg ??
    (error === "1"
      ? "كلمة المرور غير صحيحة"
      : error === "session"
        ? "لا توجد جلسة فعّالة أو تعذر حفظها في المتصفح. سجّل الدخول من جديد، وإن تكرر ذلك افتح الموقع في تبويب مستقل."
        : error);
  return (
    <div className={`animate-pop mb-4 rounded-2xl border-2 p-3 font-bold ${msg ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-rose-300 bg-rose-50 text-rose-900"}`} role="status">
      {msg ? "✅ " : "⚠️ "}
      {text}
    </div>
  );
}

export type EditableQuestion = {
  id: number;
  slideKey: string;
  kind: string;
  prompt: string;
  options: Record<string, unknown>;
  answer: Record<string, unknown>;
  explanation: string;
  skill: string;
  points: number;
  active: boolean;
};

const KINDS = ["mcq", "situation", "fill", "truefalse", "multi", "order", "dragdrop", "essay"];

export function QuestionEditor({
  question,
  action,
  onClose,
}: {
  question: EditableQuestion | null;
  action: (fd: FormData) => void | Promise<void>;
  onClose?: () => void;
}) {
  const q = question;
  const [kind, setKind] = useState(q?.kind ?? "mcq");
  const choices = Array.isArray(q?.options.choices) ? (q!.options.choices as string[]).join("\n") : "";
  const words = Array.isArray(q?.answer.order) ? (q!.answer.order as string[]).join("\n") : "";
  const pairs =
    q?.answer.map && typeof q.answer.map === "object"
      ? Object.entries(q.answer.map as Record<string, string>)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n")
      : "";
  const indices = Array.isArray(q?.answer.indices) ? (q!.answer.indices as number[]).map((i) => i + 1).join("، ") : "";
  const keywords = Array.isArray(q?.answer.keywords) ? (q!.answer.keywords as string[]).join("، ") : "";
  const input = "w-full rounded-xl border-2 border-slate-200 p-2 focus:border-turq-400 focus:outline-none";

  return (
    <form action={action} className="space-y-3 rounded-2xl border-2 border-turq-200 bg-turq-50/40 p-4">
      {q && <input type="hidden" name="id" value={q.id} />}
      <div className="grid gap-3 md:grid-cols-4">
        <label className="block text-sm font-bold">
          الموضع
          <select name="slideKey" defaultValue={q?.slideKey ?? "quiz"} className={input}>
            <option value="quiz">التقويم الختامي</option>
            <option value="book">نشاط الكتاب</option>
          </select>
        </label>
        <label className="block text-sm font-bold">
          النوع
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={input}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold">
          المهارة
          <select name="skill" defaultValue={q?.skill ?? SKILLS[0]} className={input}>
            {SKILLS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold">
          الدرجات
          <input name="points" type="number" min={1} max={10} defaultValue={q?.points ?? 1} className={input} />
        </label>
      </div>
      <label className="block text-sm font-bold">
        نص السؤال
        <textarea name="prompt" rows={2} required defaultValue={q?.prompt ?? ""} className={input} />
      </label>

      {["mcq", "situation", "fill"].includes(kind) && (
        <div className="grid gap-3 md:grid-cols-[1fr_160px]">
          <label className="block text-sm font-bold">
            الخيارات (كل خيار في سطر)
            <textarea name="choices" rows={4} defaultValue={choices} className={input} />
          </label>
          <label className="block text-sm font-bold">
            رقم الإجابة الصحيحة (يبدأ من 0)
            <input name="correctIndex" type="number" min={0} defaultValue={typeof q?.answer.index === "number" ? q.answer.index : 0} className={input} />
          </label>
        </div>
      )}
      {kind === "truefalse" && (
        <label className="block text-sm font-bold">
          الإجابة الصحيحة
          <select name="tfValue" defaultValue={q?.answer.value === false ? "false" : "true"} className={input}>
            <option value="true">صح</option>
            <option value="false">خطأ</option>
          </select>
        </label>
      )}
      {kind === "multi" && (
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="block text-sm font-bold">
            الخيارات (كل خيار في سطر)
            <textarea name="choices" rows={4} defaultValue={choices} className={input} />
          </label>
          <label className="block text-sm font-bold">
            أرقام الإجابات الصحيحة (تبدأ من 1، مفصولة بفاصلة)
            <input name="correctIndices" defaultValue={indices} className={input} placeholder="مثال: 1، 3" />
          </label>
        </div>
      )}
      {kind === "order" && (
        <label className="block text-sm font-bold">
          الكلمات بالترتيب الصحيح (كل كلمة/مقطع في سطر؛ ستُعرض مبعثرة للطالب)
          <textarea name="orderWords" rows={4} defaultValue={words} className={input} />
        </label>
      )}
      {kind === "dragdrop" && (
        <label className="block text-sm font-bold">
          الأزواج (كل سطر: العنصر=المنطقة الصحيحة)
          <textarea name="pairs" rows={4} defaultValue={pairs} className={input} placeholder={"الوضوء قبل الصلاة=الطهارة\nغسل الثوب=إزالة النجاسة"} />
        </label>
      )}
      {kind === "essay" && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm font-bold">
            الإجابة النموذجية
            <textarea name="modelAnswer" rows={3} defaultValue={typeof q?.answer.modelAnswer === "string" ? q.answer.modelAnswer : ""} className={input} />
          </label>
          <label className="block text-sm font-bold">
            كلمات مفتاحية (مفصولة بفاصلة)
            <input name="keywords" defaultValue={keywords} className={input} />
          </label>
        </div>
      )}
      <label className="block text-sm font-bold">
        التغذية الراجعة / التوضيح (يظهر للطالب بعد الإجابة)
        <input name="explanation" defaultValue={q?.explanation ?? ""} className={input} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" name="active" defaultChecked={q?.active ?? true} className="h-5 w-5" /> مفعّل
        </label>
        <button type="submit" className="rounded-xl bg-turq-600 px-5 py-2 font-bold text-white hover:bg-turq-700">
          💾 حفظ السؤال
        </button>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-200 px-4 py-2 font-bold text-slate-700">
            إلغاء
          </button>
        )}
      </div>
    </form>
  );
}

export function QuestionRow({ question, saveAction, toggleAction }: { question: EditableQuestion; saveAction: (fd: FormData) => void | Promise<void>; toggleAction: (fd: FormData) => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl border-2 p-3 ${question.active ? "border-slate-200 bg-white" : "border-dashed border-slate-300 bg-slate-50 opacity-70"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-turq-100 px-2 py-0.5 text-xs font-bold text-turq-800">{KIND_LABELS[question.kind] ?? question.kind}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{question.skill}</span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{question.points} د</span>
        {!question.active && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">معطّل</span>}
        <p className="w-full font-bold text-slate-800 md:w-auto md:flex-1">{question.prompt}</p>
        <button onClick={() => setOpen((v) => !v)} className="rounded-xl bg-turq-50 px-3 py-1 text-sm font-bold text-turq-700 hover:bg-turq-100">
          {open ? "إغلاق" : "✏️ تعديل"}
        </button>
        <form action={toggleAction}>
          <input type="hidden" name="id" value={question.id} />
          <button className="rounded-xl bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700 hover:bg-slate-200">{question.active ? "تعطيل" : "تفعيل"}</button>
        </form>
      </div>
      {open && (
        <div className="mt-3">
          <QuestionEditor question={question} action={saveAction} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

export function NewQuestionButton({ action }: { action: (fd: FormData) => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {!open ? (
        <button onClick={() => setOpen(true)} className="rounded-2xl bg-brand-orange px-5 py-3 font-black text-white shadow hover:brightness-110">
          ➕ إضافة سؤال جديد
        </button>
      ) : (
        <QuestionEditor question={null} action={action} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

export function PrintPageButton() {
  return (
    <button onClick={() => window.print()} className="no-print rounded-2xl bg-white px-4 py-2 font-bold text-turq-700 shadow hover:bg-turq-50">
      🖨️ طباعة التقرير
    </button>
  );
}
