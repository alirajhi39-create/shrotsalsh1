import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classrooms, students, studentSessions } from "@/db/schema";
import {
  STUDENT_COOKIE,
  STUDENT_SESSION_DAYS,
  clearCookieOptions,
  generateResumeCode,
  generateToken,
  hashToken,
  readBearerToken,
  sessionCookieOptions,
} from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { getStudentFromCookie, logAudit, ensureProgress } from "@/lib/student";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(2, "الاسم قصير جدًا").max(40, "الاسم طويل جدًا"),
  classroomId: z.coerce.number().int().positive(),
  resumeCode: z.string().trim().max(12).optional(),
});

function normalizeName(name: string) {
  return name.replace(/\s+/g, " ").trim();
}

export async function GET() {
  const current = await getStudentFromCookie();
  if (!current) return NextResponse.json({ student: null });
  return NextResponse.json({
    student: { id: current.id, name: current.name, classroom: current.classroomName, classroomId: current.classroomId },
  });
}

export async function POST(req: NextRequest) {
  try {
    const lessonId = await ensureSeeded();
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const name = normalizeName(parsed.data.name);
    const { classroomId } = parsed.data;
    const resumeCode = parsed.data.resumeCode?.toUpperCase();

    const [classroom] = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.active, true)))
      .limit(1);
    if (!classroom) return NextResponse.json({ error: "الفصل غير موجود" }, { status: 404 });

    const current = await getStudentFromCookie();
    let [student] = await db
      .select()
      .from(students)
      .where(and(eq(students.classroomId, classroomId), eq(students.name, name)))
      .limit(1);

    let isNew = false;
    if (student) {
      const sameDevice = current?.id === student.id;
      if (!sameDevice) {
        if (!resumeCode) {
          return NextResponse.json(
            { requiresCode: true, error: "هذا الاسم مسجل مسبقًا في هذا الفصل، أدخل رمز الاستكمال الخاص بك" },
            { status: 409 },
          );
        }
        if (resumeCode !== student.resumeCode) {
          await logAudit("student", student.id, "resume_code_failed", "students", student.id);
          return NextResponse.json({ requiresCode: true, error: "رمز الاستكمال غير صحيح" }, { status: 403 });
        }
      }
    } else {
      isNew = true;
      [student] = await db
        .insert(students)
        .values({ classroomId, name, resumeCode: generateResumeCode() })
        .onConflictDoNothing()
        .returning();
      if (!student) {
        [student] = await db
          .select()
          .from(students)
          .where(and(eq(students.classroomId, classroomId), eq(students.name, name)))
          .limit(1);
      }
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + STUDENT_SESSION_DAYS * 24 * 3600 * 1000);
    await db.insert(studentSessions).values({
      studentId: student.id,
      tokenHash: hashToken(token),
      userAgent: req.headers.get("user-agent")?.slice(0, 250) ?? "",
      expiresAt,
    });
    await ensureProgress(student.id, lessonId);
    await logAudit("student", student.id, isNew ? "student_created" : "student_resumed", "students", student.id, {
      classroomId,
    });

    const res = NextResponse.json({
      ok: true,
      isNew,
      // يُحفظ الرمز أيضًا في المتصفح كاحتياطي عندما تُحجب الكوكيز (iframe/Safari)
      token,
      student: { id: student.id, name: student.name, classroom: classroom.name, resumeCode: student.resumeCode },
    });
    res.cookies.set(STUDENT_COOKIE, token, sessionCookieOptions(req.headers, STUDENT_SESSION_DAYS * 24 * 3600));
    return res;
  } catch (err) {
    console.error("student session error", err);
    return NextResponse.json({ error: "تعذر بدء الجلسة، حاول مرة أخرى" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(STUDENT_COOKIE)?.value ?? readBearerToken(req.headers);
  if (token) {
    await db.update(studentSessions).set({ revoked: true }).where(eq(studentSessions.tokenHash, hashToken(token)));
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STUDENT_COOKIE, "", clearCookieOptions(req.headers));
  return res;
}
