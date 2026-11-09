import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { audioRecordings, lessonSlides } from "@/db/schema";
import { requireTeacher } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { getSettings } from "@/lib/student";
import { isNeon } from "@/db";
import { changePassword, deleteTeacherAudio, updateSettings, updateSlide, uploadTeacherAudio } from "../../actions";
import { ConfirmForm } from "@/components/teacher/forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireTeacher();
  const lessonId = await ensureSeeded();
  const [settings, slides, audios] = await Promise.all([
    getSettings(session.teacherId, lessonId),
    db.select().from(lessonSlides).where(eq(lessonSlides.lessonId, lessonId)).orderBy(asc(lessonSlides.orderIndex)),
    db
      .select({ id: audioRecordings.id, title: audioRecordings.title, slideKey: audioRecordings.slideKey, createdAt: audioRecordings.createdAt })
      .from(audioRecordings)
      .where(and(eq(audioRecordings.lessonId, lessonId), eq(audioRecordings.kind, "teacher")))
      .orderBy(desc(audioRecordings.createdAt)),
  ]);
  const input = "w-full rounded-xl border-2 border-slate-200 p-2 focus:border-turq-400 focus:outline-none";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black text-turq-900">الإعدادات</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-3 text-lg font-black text-turq-900">إعدادات الاختبار والأنشطة</h2>
          <form action={updateSettings} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-bold">
                نسبة النجاح المطلوبة للشهادة (%)
                <input name="passPercent" type="number" min={50} max={100} defaultValue={settings.passPercent} className={input} />
              </label>
              <label className="block text-sm font-bold">
                عدد محاولات الاختبار المسموح بها
                <input name="maxAttempts" type="number" min={1} max={10} defaultValue={settings.maxAttempts} className={input} />
              </label>
            </div>
            <label className="block text-sm font-bold">
              رابط الفيديو التعليمي لمحطة الطهارة (YouTube أو ملف mp4)
              <input name="videoUrl" type="url" defaultValue={settings.videoUrl ?? ""} placeholder="https://www.youtube.com/watch?v=…" className={input} />
              <span className="text-xs font-normal text-slate-500">اتركه فارغًا إذا لم يتوفر فيديو؛ سيُعرض للطالب زر الانتقال المباشر للنشاط.</span>
            </label>
            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" name="allowAudio" defaultChecked={settings.allowAudio} className="h-5 w-5" /> تفعيل التسجيل الصوتي للطلاب
              </label>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" name="soundsEnabled" defaultChecked={settings.soundsEnabled} className="h-5 w-5" /> أصوات التعزيز مفعّلة افتراضيًا
              </label>
            </div>
            <button className="rounded-xl bg-turq-600 px-5 py-2 font-bold text-white">💾 حفظ الإعدادات</button>
          </form>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-3 text-lg font-black text-turq-900">تغيير كلمة المرور</h2>
          <form action={changePassword} className="space-y-3">
            <label className="block text-sm font-bold">
              كلمة المرور الحالية
              <input name="current" type="password" required className={input} autoComplete="current-password" />
            </label>
            <label className="block text-sm font-bold">
              كلمة المرور الجديدة (6 أحرف على الأقل)
              <input name="next" type="password" required minLength={6} className={input} autoComplete="new-password" />
            </label>
            <button className="rounded-xl bg-slate-800 px-5 py-2 font-bold text-white">تغيير</button>
          </form>
          <div className="mt-5 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-bold">حالة قاعدة البيانات</p>
            <p>السائق: {isNeon ? "Neon Serverless (HTTP)" : "PostgreSQL (node-postgres)"}</p>
            <p>الدخول إلى اللوحة بكلمة المرور فقط (بدون اسم مستخدم).</p>
          </div>
        </section>
      </div>

      <section className="rounded-3xl bg-white p-5 shadow">
        <h2 className="mb-1 text-lg font-black text-turq-900">المحطات: العناوين وروابط الفيديو</h2>
        <p className="mb-3 text-sm text-slate-500">يمكنك إضافة رابط فيديو خاص بأي محطة؛ ويُستخدم رابط الإعدادات العام لمحطة الطهارة إن تُرك فارغًا.</p>
        <div className="space-y-2">
          {slides.map((s, i) => (
            <form key={s.id} action={updateSlide} className="grid items-center gap-2 rounded-2xl bg-slate-50 p-2 md:grid-cols-[40px_1fr_1fr_1.4fr_auto]">
              <input type="hidden" name="id" value={s.id} />
              <span className="grid h-9 w-9 place-items-center rounded-full bg-turq-600 text-sm font-black text-white">{i + 1}</span>
              <input name="title" defaultValue={s.title} required className={input} />
              <input name="subtitle" defaultValue={s.subtitle} className={input} placeholder="عنوان فرعي" />
              <input name="videoUrl" type="url" defaultValue={s.videoUrl ?? ""} className={input} placeholder="رابط فيديو (اختياري)" />
              <button className="rounded-xl bg-turq-600 px-3 py-2 text-sm font-bold text-white">حفظ</button>
            </form>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow">
        <h2 className="mb-1 text-lg font-black text-turq-900">الملفات الصوتية للمعلم</h2>
        <p className="mb-3 text-sm text-slate-500">ارفع تسجيلات صوتية (حتى 3 ميغابايت) تُحفظ في قاعدة البيانات لاستخدامها في الشرح على السبورة الذكية.</p>
        <form action={uploadTeacherAudio} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
          <input name="title" placeholder="عنوان التسجيل" className={input} />
          <select name="slideKey" className={input}>
            {slides.map((s) => (
              <option key={s.key} value={s.key}>
                {s.title}
              </option>
            ))}
          </select>
          <input name="file" type="file" accept="audio/*" required className={input} />
          <button className="rounded-xl bg-brand-orange px-4 py-2 font-bold text-white">⬆️ رفع</button>
        </form>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {audios.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-3">
              <div className="flex-1">
                <p className="font-bold text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-500">{slides.find((s) => s.key === a.slideKey)?.title}</p>
                <audio controls preload="none" src={`/api/teacher/audio/${a.id}`} className="mt-1 w-full" />
              </div>
              <ConfirmForm action={deleteTeacherAudio} hidden={{ id: a.id }} message="حذف هذا التسجيل؟">
                <button className="rounded-xl bg-rose-50 px-3 py-1 text-sm font-bold text-rose-700">حذف</button>
              </ConfirmForm>
            </li>
          ))}
          {audios.length === 0 && <li className="text-sm text-slate-500">لا توجد ملفات مرفوعة.</li>}
        </ul>
      </section>
    </div>
  );
}
