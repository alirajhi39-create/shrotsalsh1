import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { requireTeacher } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { ACTIVITIES, SLIDES } from "@/lib/content";
import { NewQuestionButton, QuestionRow } from "@/components/teacher/forms";
import { saveQuestion, toggleQuestion } from "../../actions";

export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  await requireTeacher();
  const lessonId = await ensureSeeded();
  const rows = await db.select().from(questions).where(eq(questions.lessonId, lessonId)).orderBy(asc(questions.orderIndex), asc(questions.id));
  const groups = [
    { key: "quiz", title: "أسئلة التقويم الختامي (المحطة 11)" },
    { key: "book", title: "أسئلة نشاط الكتاب المدرسي (المحطة 10)" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-turq-900">الأسئلة والأنشطة</h1>
          <p className="text-slate-500">عدّل الأسئلة أو أضف أسئلة جديدة؛ التغييرات تظهر للطلاب فورًا. تعطيل السؤال يخفيه دون حذف إجابات الطلاب السابقة.</p>
        </div>
        <NewQuestionButton action={saveQuestion} />
      </div>

      {groups.map((g) => {
        const list = rows.filter((q) => q.slideKey === g.key);
        return (
          <section key={g.key} className="rounded-3xl bg-white p-5 shadow">
            <h2 className="mb-3 text-lg font-black text-turq-900">
              {g.title} <span className="text-sm font-bold text-slate-500">({list.filter((q) => q.active).length} مفعّل)</span>
            </h2>
            <div className="space-y-2">
              {list.map((q) => (
                <QuestionRow
                  key={q.id}
                  question={{
                    id: q.id,
                    slideKey: q.slideKey,
                    kind: q.kind,
                    prompt: q.prompt,
                    options: q.options,
                    answer: q.answer,
                    explanation: q.explanation,
                    skill: q.skill,
                    points: q.points,
                    active: q.active,
                  }}
                  saveAction={saveQuestion}
                  toggleAction={toggleQuestion}
                />
              ))}
            </div>
          </section>
        );
      })}

      <section className="rounded-3xl bg-white p-5 shadow">
        <h2 className="mb-1 text-lg font-black text-turq-900">أنشطة المحطات التفاعلية</h2>
        <p className="mb-3 text-sm text-slate-500">هذه الأنشطة مبنية على محتوى الكتاب ومصححة تلقائيًا. يمكن تعديل عناوين المحطات وروابط الفيديو من صفحة الإعدادات.</p>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(ACTIVITIES).map(([key, a]) => (
            <div key={key} className="rounded-2xl border border-slate-200 p-3 text-sm">
              <p className="text-xs font-bold text-turq-700">{SLIDES.find((s) => s.key === a.slideKey)?.title}</p>
              <p className="font-bold text-slate-800">{a.title}</p>
              <p className="text-xs text-slate-500">
                {a.kind} — {a.maxScore} درجة — {a.required ? "إلزامي" : "اختياري"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
