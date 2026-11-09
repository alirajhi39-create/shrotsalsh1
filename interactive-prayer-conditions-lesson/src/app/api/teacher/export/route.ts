import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { db } from "@/db";
import { certificates, classrooms, quizAttempts, studentProgress, students } from "@/db/schema";
import { teacherSessionFromRequest } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { SLIDES } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await teacherSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const lessonId = await ensureSeeded();
  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const classroomId = Number(url.searchParams.get("classroomId") || 0);

  const where = classroomId
    ? and(eq(classrooms.teacherId, session.teacherId), eq(students.classroomId, classroomId))
    : eq(classrooms.teacherId, session.teacherId);

  const rows = await db
    .select({
      id: students.id,
      name: students.name,
      classroom: classrooms.name,
      currentSlide: studentProgress.currentSlide,
      completedSlides: studentProgress.completedSlides,
      points: studentProgress.points,
      stars: studentProgress.stars,
      completedAt: studentProgress.completedAt,
      updatedAt: studentProgress.updatedAt,
    })
    .from(students)
    .innerJoin(classrooms, eq(classrooms.id, students.classroomId))
    .leftJoin(studentProgress, and(eq(studentProgress.studentId, students.id), eq(studentProgress.lessonId, lessonId)))
    .where(where)
    .orderBy(asc(classrooms.name), asc(students.name));

  const attempts = await db
    .select()
    .from(quizAttempts)
    .where(eq(quizAttempts.lessonId, lessonId));
  const certs = await db.select().from(certificates).where(and(eq(certificates.lessonId, lessonId), eq(certificates.revoked, false)));

  const data = rows.map((r) => {
    const mine = attempts.filter((a) => a.studentId === r.id);
    const best = mine.length ? Math.max(...mine.map((a) => a.percent)) : null;
    const cert = certs.find((c) => c.studentId === r.id);
    const completed = r.completedSlides ?? [];
    return {
      "اسم الطالب": r.name,
      "الفصل": r.classroom,
      "المحطة الحالية": r.currentSlide !== null && r.currentSlide !== undefined ? SLIDES[r.currentSlide]?.title ?? "" : "لم يبدأ",
      "المحطات المكتملة": `${completed.length} / ${SLIDES.length}`,
      "نسبة الإكمال %": Math.round((completed.length / SLIDES.length) * 100),
      "النقاط": r.points ?? 0,
      "النجوم": r.stars ?? 0,
      "عدد محاولات الاختبار": mine.length,
      "أفضل نسبة في الاختبار %": best === null ? "" : Math.round(best),
      "بانتظار تصحيح": mine.some((a) => a.pendingReview) ? "نعم" : "لا",
      "الشهادة": cert ? cert.serial : "",
      "أكمل الدرس": r.completedAt ? new Date(r.completedAt).toLocaleString("ar-SA") : "",
      "آخر نشاط": r.updatedAt ? new Date(r.updatedAt).toLocaleString("ar-SA") : "",
    };
  });

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "xlsx") {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    if (!wb.Workbook) wb.Workbook = {};
    wb.Workbook.Views = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, "النتائج");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="results-${stamp}.xlsx"`,
      },
    });
  }

  const headers = Object.keys(data[0] ?? { "اسم الطالب": "" });
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv =
    "\uFEFF" +
    [headers.join(","), ...data.map((row) => headers.map((h) => escape((row as Record<string, unknown>)[h])).join(","))].join(
      "\r\n",
    );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="results-${stamp}.csv"`,
    },
  });
}
