import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { certificates } from "@/db/schema";
import { LESSON, CONDITIONS } from "@/lib/content";
import { PrintButton } from "@/components/lesson/ui";

export const dynamic = "force-dynamic";

export default async function CertificatePage({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  const [cert] = await db
    .select()
    .from(certificates)
    .where(and(eq(certificates.serial, serial), eq(certificates.revoked, false)))
    .limit(1);
  if (!cert) notFound();

  const date = new Date(cert.issuedAt);
  const hijri = new Intl.DateTimeFormat("ar-SA-u-ca-islamic", { dateStyle: "long" }).format(date);
  const greg = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { dateStyle: "long" }).format(date);

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="no-print mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <Link href="/lesson" className="rounded-2xl bg-white px-4 py-2 font-bold text-turq-700 shadow">
          → العودة إلى الدرس
        </Link>
        <PrintButton />
      </div>

      <div className="print-area mx-auto max-w-5xl overflow-hidden rounded-[2rem] border-[14px] border-double border-turq-600 bg-white shadow-2xl">
        <div className="pattern-bg relative p-8 md:p-12">
          <div className="absolute inset-x-0 top-0 h-3 bg-gradient-to-l from-turq-500 via-brand-blue to-brand-orange" />
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm font-bold text-slate-600">
            <div>
              <p>المملكة العربية السعودية</p>
              <p>وزارة التعليم</p>
              <p>{LESSON.school}</p>
            </div>
            <div className="text-6xl">🕌</div>
            <div className="text-start">
              <p>{LESSON.subject}</p>
              <p>{LESSON.grade}</p>
              <p>الدرس {LESSON.lessonNumber}: {LESSON.title}</p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-lg font-bold text-brand-orange">شهادة إنجاز</p>
            <h1 className="mt-1 text-4xl font-black text-turq-900 md:text-5xl">بطل شروط الصلاة</h1>
            <p className="mt-6 text-xl text-slate-700">تشهد إدارة {LESSON.school} بأن الطالب</p>
            <p className="my-4 text-4xl font-black text-brand-blue md:text-5xl">{cert.studentName}</p>
            <p className="text-xl text-slate-700">
              من فصل <b>{cert.classroomName}</b> قد أتم بنجاح الرحلة التعليمية لدرس <b>«{LESSON.title}»</b>
            </p>
            <p className="mt-1 text-xl text-slate-700">
              وحقق نسبة <b className="text-brand-green">{Math.round(cert.percent)}%</b> في التقويم الختامي
            </p>
          </div>

          <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2">
            {CONDITIONS.map((c) => (
              <span key={c.key} className="rounded-full border border-turq-200 bg-white px-3 py-1 text-sm font-bold text-turq-800">
                {c.icon} {c.name}
              </span>
            ))}
          </div>

          <div className="mt-10 grid items-end gap-6 md:grid-cols-3">
            <div className="text-center text-sm font-bold text-slate-600">
              <p>معلم المادة</p>
              <p className="mt-6 border-t-2 border-slate-300 pt-2 text-lg text-turq-900">{LESSON.teacher}</p>
            </div>
            <div className="relative mx-auto h-32 w-32">
              <Image src="/images/champion-badge.png" alt="وسام" fill className="object-contain" />
            </div>
            <div className="text-center text-sm font-bold text-slate-600">
              <p>تاريخ الإصدار</p>
              <p className="mt-2">{hijri}</p>
              <p>{greg}</p>
            </div>
          </div>

          <p className="mt-8 text-center font-mono text-xs text-slate-400">رقم الشهادة: {cert.serial} — للتحقق: /certificate/{cert.serial}</p>
        </div>
      </div>
    </main>
  );
}
