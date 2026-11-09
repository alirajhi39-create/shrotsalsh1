import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTeacherSession } from "@/lib/auth";
import { LESSON } from "@/lib/content";
import { loginAction } from "../actions";
import { FlashMessage } from "@/components/teacher/forms";
import IframeHint from "@/components/IframeHint";
import TeacherLoginForm from "@/components/teacher/TeacherLoginForm";

export const dynamic = "force-dynamic";

export default async function TeacherLoginPage() {
  if (await getTeacherSession()) redirect("/teacher");
  return (
    <main className="pattern-bg grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-4 inline-block text-sm font-bold text-turq-700">
          → العودة لصفحة الطلاب
        </Link>
        <div className="rounded-3xl bg-white p-8 shadow-2xl shadow-turq-900/10">
          <div className="mb-6 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-turq-500 to-brand-blue text-3xl text-white">👨‍🏫</div>
            <h1 className="mt-3 text-2xl font-black text-turq-900">لوحة تحكم المعلم</h1>
            <p className="text-sm text-slate-500">
              {LESSON.title} — {LESSON.school}
            </p>
            <p className="mt-1 text-sm font-bold text-turq-800">{LESSON.teacher}</p>
          </div>
          <IframeHint />
          <Suspense>
            <FlashMessage />
          </Suspense>
          <TeacherLoginForm fallbackAction={loginAction} />
          <p className="mt-4 text-center text-xs text-slate-400">يمكن تغيير كلمة المرور من صفحة الإعدادات بعد الدخول.</p>
        </div>
      </div>
    </main>
  );
}
