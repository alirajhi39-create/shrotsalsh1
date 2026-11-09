import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import {
  TEACHER_COOKIE,
  TEACHER_SESSION_SECONDS,
  clearCookieOptions,
  createSignedToken,
  getTeacherSession,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { logAudit } from "@/lib/student";

export const dynamic = "force-dynamic";

const schema = z.object({ password: z.string().min(1).max(200) });

export async function GET() {
  const session = await getTeacherSession();
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, teacherId: session.teacherId });
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeeded();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "أدخل كلمة المرور" }, { status: 400 });

    const rows = await db.select().from(teachers);
    const teacher = rows.find((row) => verifyPassword(parsed.data.password, row.passwordHash));
    if (!teacher) {
      await logAudit("teacher", null, "login_failed", "teachers", null);
      return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 });
    }

    const token = createSignedToken({ tid: teacher.id, u: teacher.username }, TEACHER_SESSION_SECONDS);
    await logAudit("teacher", teacher.id, "login", "teachers", teacher.id);
    const res = NextResponse.json({ ok: true, token });
    res.cookies.set(TEACHER_COOKIE, token, sessionCookieOptions(req.headers, TEACHER_SESSION_SECONDS));
    return res;
  } catch (err) {
    console.error("teacher session error", err);
    return NextResponse.json({ error: "تعذر تسجيل الدخول، حاول مرة أخرى" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TEACHER_COOKIE, "", clearCookieOptions(req.headers));
  return res;
}
