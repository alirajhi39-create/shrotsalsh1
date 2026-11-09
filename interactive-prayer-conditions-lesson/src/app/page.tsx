import SafeImage from "@/components/lesson/SafeImage";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classrooms } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { getStudentFromCookie } from "@/lib/student";
import { CONDITIONS, LESSON, SLIDES } from "@/lib/content";
import StudentApp from "@/components/StudentApp";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureSeeded();
  const [rooms, current] = await Promise.all([
    db.select({ id: classrooms.id, name: classrooms.name }).from(classrooms).where(eq(classrooms.active, true)).orderBy(asc(classrooms.name)),
    getStudentFromCookie(),
  ]);

  return (
    <main className="pattern-bg min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-turq-500 to-brand-blue text-2xl text-white shadow">🕌</div>
          <div>
            <p className="text-xs font-bold text-slate-500">{LESSON.school}</p>
            <p className="font-black text-turq-900">{LESSON.subject}</p>
          </div>
        </div>
        <Link href="/teacher/login" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-turq-700 shadow hover:bg-turq-50">
          👨‍🏫 دخول المعلم
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-6 lg:grid-cols-2">
        <div className="animate-fadeup">
          <span className="inline-block rounded-full bg-brand-orange/15 px-4 py-1 text-sm font-black text-orange-700">
            الدرس {LESSON.lessonNumber} • {LESSON.grade} • ص {LESSON.pages}
          </span>
          <h1 className="mt-4 text-4xl font-black leading-tight text-turq-900 md:text-6xl">{LESSON.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-700">
            رحلة تعليمية تفاعلية من <b>{SLIDES.length} محطة</b>: اكتشف، العب، فكّر، وأجب… ثم احصل على شهادة «بطل شروط الصلاة»!
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {CONDITIONS.map((c) => (
              <span key={c.key} className="rounded-2xl bg-white px-3 py-2 text-sm font-bold text-turq-800 shadow-sm">
                {c.icon} {c.name}
              </span>
            ))}
          </div>
          <SafeImage
            src="/images/hero-boy.webp"
            alt="طالب يستعد للصلاة"
            className="mx-auto mt-6 h-64 w-64 animate-float lg:h-80 lg:w-80"
            imgClassName="drop-shadow-2xl"
            fallback="🧒"
          />
          <p className="text-sm text-slate-500">
            المعلم: {LESSON.teacher} — {LESSON.school}
          </p>
        </div>
        <div className="animate-fadeup lg:sticky lg:top-6">
          <StudentApp classrooms={rooms} current={current ? { id: current.id, name: current.name, classroom: current.classroomName } : null} />
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold text-slate-600">
            <div className="rounded-2xl bg-white/80 p-3 shadow-sm">📱 يعمل على الجوال والأجهزة اللوحية</div>
            <div className="rounded-2xl bg-white/80 p-3 shadow-sm">🖥️ مناسب للسبورة الذكية</div>
            <div className="rounded-2xl bg-white/80 p-3 shadow-sm">💾 يحفظ تقدمك تلقائيًا</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <h2 className="mb-4 text-2xl font-black text-turq-900">محطات الرحلة</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {SLIDES.map((s, i) => (
            <div key={s.key} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-turq-100 text-xl">{s.emoji}</span>
              <div>
                <p className="text-sm font-black text-turq-900">
                  {i + 1}. {s.title}
                </p>
                <p className="text-xs text-slate-500">{s.strategy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
