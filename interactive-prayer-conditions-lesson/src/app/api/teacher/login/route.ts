import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import {
  TEACHER_COOKIE,
  TEACHER_SESSION_SECONDS,
  createSignedToken,
  hashPassword,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { logAudit } from "@/lib/student";

export const dynamic = "force-dynamic";

const schema = z.object({ password: z.string().min(1).max(200) });

/** دخول المعلم بكلمة المرور فقط — مسار API عادي لا يتأثر بفحص أصول Server Actions داخل iframe. */
export async function POST(req: NextRequest) {
  try {
    await ensureSeeded();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "أدخل كلمة المرور" }, { status: 400 });

    const all = await db.select().from(teachers);
    const teacher = all.find((t) => verifyPassword(parsed.data.password, t.passwordHash)) ?? null;
    if (!teacher) {
      await logAudit("teacher", null, "login_failed", "teachers", null);
      return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 });
    }

    const token = createSignedToken({ tid: teacher.id, u: teacher.username }, TEACHER_SESSION_SECONDS);
    await logAudit("teacher", teacher.id, "login", "teachers", teacher.id);
    const res = NextResponse.json({
      ok: true,
      token,
      teacher: { id: teacher.id, name: teacher.name, school: teacher.school },
    });
    // الكوكي اختياري؛ الرمز في ترويسة Authorization هو الأساس
    res.cookies.set(TEACHER_COOKIE, token, sessionCookieOptions(req.headers, TEACHER_SESSION_SECONDS));
    return res;
  } catch (err) {
    console.error("teacher login error", err);
    return NextResponse.json({ error: "تعذر تسجيل الدخول، حاول مرة أخرى" }, { status: 500 });
  }
}

/** تغيير كلمة المرور من الواجهة (يُستدعى عبر /api/teacher/action) */
export function hashNewPassword(password: string) {
  return hashPassword(password);
}
