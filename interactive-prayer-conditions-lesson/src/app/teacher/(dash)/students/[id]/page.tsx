import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { achievements, audioRecordings, certificates, classrooms, questions, quizAttempts, studentAnswers, studentProgress, students } from "@/db/schema";
import { requireTeacher } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { getSettings } from "@/lib/student";
import { ACTIVITIES, SLIDES } from "@/lib/content";
import { KIND_LABELS, humanizeActivityAnswer, humanizeResponse } from "@/lib/grading";
import { ConfirmForm, PrintPageButton } from "@/components/teacher/forms";
import {
  deleteStudent,
  gradeAnswer,
  grantExtraAttempt,
  issueCertificateAction,
  regenerateResumeCode,
  resetStudentProgress,
  revokeCertificateAction,
  updateStudent,
} from "../../../actions";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireTeacher();
  const { id } = await params;
  const studentId = Number(id);
  if (!Number.isInteger(studentId)) notFound();
  const lessonId = await ensureSeeded();

  const [student] = await db
    .select({ id: students.id, name: students.name, classroomId: students.classroomId, classroom: classrooms.name, resumeCode: students.resumeCode, locked: students.locked, createdAt: students.createdAt })
    .from(students)
    .innerJoin(classrooms, eq(classrooms.id, students.classroomId))
    .where(and(eq(students.id, studentId), eq(classrooms.teacherId, session.teacherId)))
    .limit(1);
  if (!student) notFound();

  const [rooms, settings, progressRows, answers, attempts, qs, achs, certs, audios] = await Promise.all([
    db.select().from(classrooms).where(eq(classrooms.teacherId, session.teacherId)).orderBy(asc(classrooms.name)),
    getSettings(session.teacherId, lessonId),
    db.select().from(studentProgress).where(and(eq(studentProgress.studentId, studentId), eq(studentProgress.lessonId, lessonId))).limit(1),
    db.select().from(studentAnswers).where(and(eq(studentAnswers.studentId, studentId), eq(studentAnswers.lessonId, lessonId))).orderBy(asc(studentAnswers.createdAt)),
    db.select().from(quizAttempts).where(and(eq(quizAttempts.studentId, studentId), eq(quizAttempts.lessonId, lessonId))).orderBy(desc(quizAttempts.attemptNumber)),
    db.select().from(questions).where(eq(questions.lessonId, lessonId)),
    db.select().from(achievements).where(and(eq(achievements.studentId, studentId), eq(achievements.lessonId, lessonId))),
    db.select().from(certificates).where(and(eq(certificates.studentId, studentId), eq(certificates.lessonId, lessonId))).limit(1),
    db.select({ id: audioRecordings.id, slideKey: audioRecordings.slideKey, mimeType: audioRecordings.mimeType, durationMs: audioRecordings.durationMs, createdAt: audioRecordings.createdAt, title: audioRecordings.title }).from(audioRecordings).where(and(eq(audioRecordings.studentId, studentId), eq(audioRecordings.lessonId, lessonId))).orderBy(desc(audioRecordings.createdAt)),
  ]);
  const progress = progressRows[0];
  const qById = new Map(qs.map((q) => [q.id, q]));
  const activityAnswers = answers.filter((a) => a.attemptId === 0 && a.questionId === null);
  const bookAnswers = answers.filter((a) => a.attemptId === 0 && a.questionId !== null);
  const cert = certs[0] && !certs[0].revoked ? certs[0] : null;
  const input = "rounded-xl border-2 border-slate-200 p-2 focus:border-turq-400 focus:outline-none";
  const slideTitle = (k: string) => SLIDES.find((s) => s.key === k)?.title ?? k;

  const GradeForm = ({ a }: { a: (typeof answers)[number] }) => (
    <form action={gradeAnswer} className="mt-2 flex flex-wrap items-end gap-2 rounded-xl bg-amber-50 p-2">
      <input type="hidden" name="answerId" value={a.id} />
      <label className="text-xs font-bold">
        الدرجة (من {a.maxScore})
        <input name="score" type="number" min={0} max={a.maxScore} defaultValue={a.teacherScore ?? a.maxScore} className={`${input} block w-24`} />
      </label>
      <label className="flex-1 text-xs font-bold">
        ملاحظة للطالب
        <input name="feedback" defaultValue={a.teacherFeedback ?? ""} className={`${input} block w-full`} placeholder="أحسنت…" />
      </label>
      <button className="rounded-xl bg-turq-600 px-4 py-2 text-sm font-bold text-white">{a.teacherScore === null ? "اعتماد التصحيح" : "تحديث"}</button>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/teacher/students" className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-turq-700 shadow">
          → قائمة الطلاب
        </Link>
        <h1 className="text-3xl font-black text-turq-900">{student.name}</h1>
        <span className="rounded-full bg-turq-100 px-3 py-1 font-bold text-turq-800">{student.classroom}</span>
        <div className="ms-auto">
          <PrintPageButton />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl bg-white p-4 shadow">
          <p className="text-xs text-slate-500">التقدم</p>
          <p className="text-3xl font-black text-turq-900">{progress ? Math.round((progress.completedSlides.length / SLIDES.length) * 100) : 0}%</p>
          <p className="text-xs text-slate-500">المحطة الحالية: {progress ? slideTitle(SLIDES[progress.currentSlide]?.key ?? "") : "—"}</p>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow">
          <p className="text-xs text-slate-500">النقاط / النجوم</p>
          <p className="text-3xl font-black text-turq-900">
            🏅 {progress?.points ?? 0} ⭐ {progress?.stars ?? 0}
          </p>
          <p className="text-xs text-slate-500">الأوسمة: {achs.map((a) => a.icon).join(" ") || "—"}</p>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow">
          <p className="text-xs text-slate-500">الاختبار (أفضل نتيجة)</p>
          <p className="text-3xl font-black text-turq-900">{attempts.length ? `${Math.round(Math.max(...attempts.map((a) => a.percent)))}%` : "—"}</p>
          <p className="text-xs text-slate-500">
            المحاولات: {attempts.length} / {settings.maxAttempts + (progress?.extraAttempts ?? 0)}
          </p>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow">
          <p className="text-xs text-slate-500">رمز الاستكمال</p>
          <p className="font-mono text-3xl font-black tracking-widest text-orange-700">{student.resumeCode}</p>
          <p className="text-xs text-slate-500">مسجل منذ {new Date(student.createdAt).toLocaleDateString("ar-SA")}</p>
        </div>
      </div>

      <section className="no-print grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-3 text-lg font-black text-turq-900">تعديل بيانات الطالب</h2>
          <form action={updateStudent} className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <input type="hidden" name="id" value={student.id} />
            <input name="name" defaultValue={student.name} required minLength={2} className={input} />
            <select name="classroomId" defaultValue={student.classroomId} className={input}>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" name="locked" defaultChecked={student.locked} className="h-5 w-5" /> تثبيت
            </label>
            <button className="rounded-xl bg-turq-600 px-4 py-2 font-bold text-white">حفظ</button>
          </form>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-3 text-lg font-black text-turq-900">إجراءات</h2>
          <div className="flex flex-wrap gap-2">
            <form action={grantExtraAttempt}>
              <input type="hidden" name="id" value={student.id} />
              <button className="rounded-xl bg-brand-orange px-3 py-2 text-sm font-bold text-white">🔁 السماح بمحاولة إضافية</button>
            </form>
            {cert ? (
              <>
                <Link href={`/certificate/${cert.serial}`} className="rounded-xl bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-800">
                  🎓 عرض الشهادة ({cert.serial})
                </Link>
                <ConfirmForm action={revokeCertificateAction} hidden={{ id: student.id }} message="إلغاء شهادة الطالب؟">
                  <button className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">إلغاء الشهادة</button>
                </ConfirmForm>
              </>
            ) : (
              <ConfirmForm action={issueCertificateAction} hidden={{ id: student.id }} message="إصدار شهادة لهذا الطالب يدويًا (تجاوز الشروط)؟">
                <button className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white">🎓 إصدار شهادة يدويًا</button>
              </ConfirmForm>
            )}
            <ConfirmForm action={regenerateResumeCode} hidden={{ id: student.id }} message="توليد رمز استكمال جديد وإنهاء جلسات الطالب الحالية؟">
              <button className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">🔑 رمز جديد</button>
            </ConfirmForm>
            <ConfirmForm action={resetStudentProgress} hidden={{ id: student.id }} message="سيتم حذف جميع إجابات الطالب ومحاولاته وشهادته. متابعة؟">
              <button className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">♻️ إعادة تعيين التقدم</button>
            </ConfirmForm>
            <ConfirmForm action={deleteStudent} hidden={{ id: student.id }} message="حذف الطالب نهائيًا مع جميع بياناته؟">
              <button className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white">🗑️ حذف الطالب</button>
            </ConfirmForm>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow">
        <h2 className="mb-3 text-lg font-black text-turq-900">إجابات أنشطة المحطات ({activityAnswers.length})</h2>
        {activityAnswers.length === 0 ? (
          <p className="text-sm text-slate-500">لم يُجب الطالب عن أي نشاط بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="p-2 text-start">المحطة</th>
                  <th className="p-2 text-start">النشاط</th>
                  <th className="p-2 text-start">الإجابة</th>
                  <th className="p-2">النتيجة</th>
                  <th className="p-2">الوقت</th>
                </tr>
              </thead>
              <tbody>
                {activityAnswers.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100 align-top">
                    <td className="p-2">{slideTitle(a.slideKey)}</td>
                    <td className="p-2 font-bold">{ACTIVITIES[a.activityKey]?.title ?? a.activityKey}</td>
                    <td className="max-w-md p-2 text-slate-700">{humanizeActivityAnswer(a.answer)}</td>
                    <td className="p-2 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${a.isCorrect ? "bg-emerald-100 text-emerald-800" : a.isCorrect === false ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                        {a.score}/{a.maxScore}
                      </span>
                    </td>
                    <td className="p-2 text-center text-slate-500">{new Date(a.updatedAt).toLocaleString("ar-SA")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow">
        <h2 className="mb-3 text-lg font-black text-turq-900">نشاط الكتاب المدرسي ({bookAnswers.length})</h2>
        <div className="space-y-3">
          {bookAnswers.map((a) => {
            const q = a.questionId ? qById.get(a.questionId) : undefined;
            return (
              <div key={a.id} className="rounded-2xl border border-slate-200 p-3">
                <p className="text-xs font-bold text-slate-500">{q ? KIND_LABELS[q.kind] : ""}</p>
                <p className="font-bold text-slate-800">{q?.prompt}</p>
                <p className="mt-1 rounded-xl bg-slate-50 p-2 text-slate-700">{q ? humanizeResponse(q.kind, q.options, a.answer) : JSON.stringify(a.answer)}</p>
                <p className="mt-1 text-sm">
                  {a.needsReview ? (
                    a.teacherScore === null ? (
                      <span className="font-bold text-amber-700">⏳ بانتظار التصحيح</span>
                    ) : (
                      <span className="font-bold text-emerald-700">
                        ✓ صُحح: {a.teacherScore}/{a.maxScore}
                      </span>
                    )
                  ) : (
                    <span className={a.isCorrect ? "font-bold text-emerald-700" : "font-bold text-rose-700"}>
                      {a.isCorrect ? "✓ صحيحة" : "✗ غير صحيحة"} ({a.score}/{a.maxScore})
                    </span>
                  )}
                </p>
                {a.needsReview && (
                  <>
                    {q && typeof q.answer.modelAnswer === "string" && <p className="mt-1 text-xs text-slate-500">الإجابة النموذجية: {q.answer.modelAnswer}</p>}
                    <GradeForm a={a} />
                  </>
                )}
              </div>
            );
          })}
          {bookAnswers.length === 0 && <p className="text-sm text-slate-500">لم يبدأ نشاط الكتاب بعد.</p>}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow">
        <h2 className="mb-3 text-lg font-black text-turq-900">محاولات التقويم الختامي ({attempts.length})</h2>
        {attempts.length === 0 && <p className="text-sm text-slate-500">لم يؤدِّ الطالب الاختبار بعد.</p>}
        <div className="space-y-4">
          {attempts.map((at) => {
            const rows = answers.filter((a) => a.attemptId === at.attemptNumber && a.slideKey === "quiz");
            return (
              <div key={at.id} className="rounded-2xl border-2 border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-turq-600 px-3 py-1 font-black text-white">المحاولة {at.attemptNumber}</span>
                  <span className="text-2xl font-black text-turq-900">{Math.round(at.percent)}%</span>
                  <span className="text-sm text-slate-600">
                    آلي: {at.autoScore}/{at.maxAutoScore} — كتابي: {at.teacherScore}/{at.maxTeacherScore}
                  </span>
                  {at.pendingReview && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">بانتظار التصحيح</span>}
                  <span className="ms-auto text-xs text-slate-500">{new Date(at.submittedAt).toLocaleString("ar-SA")}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {Object.entries(at.skillReport).map(([sk, v]) => (
                    <span key={sk} className={`rounded-full px-2 py-0.5 font-bold ${v.max && v.earned / v.max >= 0.6 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
                      {sk}: {v.earned}/{v.max}
                    </span>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  {rows.map((a) => {
                    const q = a.questionId ? qById.get(a.questionId) : undefined;
                    return (
                      <div key={a.id} className="rounded-xl bg-slate-50 p-2 text-sm">
                        <p className="font-bold text-slate-800">{q?.prompt ?? `سؤال #${a.questionId}`}</p>
                        <p className="text-slate-700">الإجابة: {q ? humanizeResponse(q.kind, q.options, a.answer) : "—"}</p>
                        <p className={a.needsReview ? "text-amber-700" : a.isCorrect ? "text-emerald-700" : "text-rose-700"}>
                          {a.needsReview ? (a.teacherScore === null ? "⏳ يحتاج تصحيحًا" : `✓ صُحح ${a.teacherScore}/${a.maxScore}`) : `${a.isCorrect ? "✓" : "✗"} ${a.score}/${a.maxScore}`}
                        </p>
                        {a.needsReview && <GradeForm a={a} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow">
        <h2 className="mb-3 text-lg font-black text-turq-900">التسجيلات الصوتية ({audios.length})</h2>
        {!settings.allowAudio && <p className="mb-2 text-xs text-amber-700">التسجيل الصوتي معطّل حاليًا من الإعدادات.</p>}
        {audios.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد تسجيلات.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {audios.map((r) => (
              <li key={r.id} className="rounded-2xl bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-700">
                  {slideTitle(r.slideKey)} — {ACTIVITIES[r.title]?.title ?? r.title}
                </p>
                <audio controls preload="none" src={`/api/teacher/audio/${r.id}`} className="mt-2 w-full" />
                <p className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString("ar-SA")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
