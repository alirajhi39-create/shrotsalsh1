import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import { getTeacherSession } from "@/lib/auth";
import { logoutAction } from "../actions";
import { FlashMessage } from "@/components/teacher/forms";
import TeacherAuthBridge from "@/components/teacher/TeacherAuthBridge";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/teacher", label: "النظرة العامة", icon: "📊" },
  { href: "/teacher/students", label: "الطلاب والفصول", icon: "🧑‍🎓" },
  { href: "/teacher/questions", label: "الأسئلة والأنشطة", icon: "📝" },
  { href: "/teacher/board", label: "السبورة الذكية", icon: "🖥️" },
  { href: "/teacher/settings", label: "الإعدادات", icon: "⚙️" },
];

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const session = await getTeacherSession();
  if (!session) redirect("/teacher/login?error=session");
  const [teacher] = await db.select().from(teachers).where(eq(teachers.id, session.teacherId)).limit(1);
  if (!teacher) redirect("/teacher/login?error=session");

  return (
    <div className="min-h-screen bg-slate-50">
      <TeacherAuthBridge />
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-turq-500 to-brand-blue text-xl text-white">👨‍🏫</div>
            <div>
              <p className="text-xs text-slate-500">{teacher.school}</p>
              <p className="font-black text-turq-900">{teacher.name}</p>
            </div>
          </div>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto md:order-2 md:w-auto md:flex-1 md:justify-center">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold text-slate-700 hover:bg-turq-50 hover:text-turq-800">
                {n.icon} {n.label}
              </Link>
            ))}
          </nav>
          <div className="order-2 ms-auto flex items-center gap-2 md:order-3">
            <Link href="/" className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
              صفحة الطلاب
            </Link>
            <form id="teacher-logout-form" action={logoutAction}>
              <button className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100">خروج</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Suspense>
          <FlashMessage />
        </Suspense>
        {children}
      </main>
    </div>
  );
}
