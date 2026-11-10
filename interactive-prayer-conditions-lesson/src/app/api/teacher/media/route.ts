import { NextRequest, NextResponse } from "next/server";
import { teacherSessionFromRequest } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { changeMedia, listTeacherMedia, mediaChangeSchema, mediaSaveSchema, saveMedia } from "@/lib/media-server";
import { logAudit } from "@/lib/student";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const teacher = await teacherSessionFromRequest(req);
  if (!teacher) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const lessonId = await ensureSeeded();
  return NextResponse.json({ ok: true, media: await listTeacherMedia(lessonId) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const teacher = await teacherSessionFromRequest(req);
  if (!teacher) return NextResponse.json({ error: "انتهت جلسة المعلم؛ سجّل الدخول من جديد" }, { status: 401 });
  const raw = await req.text();
  if (raw.length > 4_300_000) return NextResponse.json({ error: "حجم الطلب كبير؛ الصورة حتى 2 م.ب والصوت حتى 3 م.ب، أو استخدم رابطًا مباشرًا" }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 }); }
  try {
    if (body && typeof body === "object" && "action" in body) {
      const parsed = mediaChangeSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: "بيانات التعديل غير صالحة" }, { status: 400 });
      const result = await changeMedia(teacher.teacherId, parsed.data);
      await logAudit("teacher", teacher.teacherId, `media_${parsed.data.action}`, "lesson_media", result.id);
      const deleteMessage = result.kind === "image" ? "تمت استعادة الصورة الأصلية لجميع الأجهزة" : "hiddenLegacy" in result && result.hiddenLegacy ? "تم إخفاء المقطع القديم مع حفظ الملف الأصلي" : "تم حذف المقطع";
      return NextResponse.json({ ok: true, msg: parsed.data.action === "delete" ? deleteMessage : "تم تحديث الوسيط لجميع الأجهزة", result });
    }
    const parsed = mediaSaveSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "أكمل بيانات الوسيط" }, { status: 400 });
    const result = await saveMedia(teacher.teacherId, parsed.data);
    await logAudit("teacher", teacher.teacherId, "media_saved", "lesson_media", result.id, { kind: result.kind, slot: result.slot, slideKey: result.slideKey, source: result.source });
    return NextResponse.json({ ok: true, msg: "تم الحفظ في قاعدة البيانات وسيظهر لجميع الطلاب على مختلف الأجهزة", media: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ الوسيط";
    const safe = /الحد|نوع|محتوى|رابط|محلية|عنوان|موجود|صالح/.test(message);
    return NextResponse.json({ error: safe ? message : "تعذر حفظ الوسيط في قاعدة البيانات؛ حاول مرة أخرى" }, { status: safe ? 400 : 500 });
  }
}
