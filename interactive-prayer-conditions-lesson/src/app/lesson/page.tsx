import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classrooms } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { getStudentFromCookie } from "@/lib/student";
import StudentApp from "@/components/StudentApp";

export const dynamic = "force-dynamic";

/** الرابط المباشر للدرس: يعرض الرحلة، ويعود لشاشة الدخول في نفس الصفحة إن انتهت الجلسة */
export default async function LessonPage() {
  await ensureSeeded();
  const [rooms, current] = await Promise.all([
    db.select({ id: classrooms.id, name: classrooms.name }).from(classrooms).where(eq(classrooms.active, true)).orderBy(asc(classrooms.name)),
    getStudentFromCookie(),
  ]);
  return (
    <StudentApp
      classrooms={rooms}
      current={current ? { id: current.id, name: current.name, classroom: current.classroomName } : null}
      initialStarted
    />
  );
}
