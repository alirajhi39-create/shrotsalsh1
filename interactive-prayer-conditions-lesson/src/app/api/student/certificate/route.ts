import { NextResponse } from "next/server";
import { ensureSeeded } from "@/lib/seed";
import { buildStudentState, checkEligibility, getSettings, getStudentFromCookie, issueCertificate } from "@/lib/student";

export const dynamic = "force-dynamic";

export async function POST() {
  const student = await getStudentFromCookie();
  if (!student) return NextResponse.json({ error: "انتهت الجلسة، سجّل الدخول من جديد" }, { status: 401 });
  const lessonId = await ensureSeeded();
  const settings = await getSettings(student.teacherId, lessonId);
  const eligibility = await checkEligibility(student.id, lessonId, settings);
  if (!eligibility.eligible) {
    return NextResponse.json({ error: "لم تكتمل شروط الحصول على الشهادة بعد", reasons: eligibility.reasons }, { status: 400 });
  }
  const cert = await issueCertificate(
    { id: student.id, name: student.name, classroomName: student.classroomName },
    lessonId,
    eligibility.bestPercent ?? 0,
    "system",
  );
  const state = await buildStudentState(student);
  return NextResponse.json({ ok: true, certificate: cert ? { serial: cert.serial } : null, state });
}
