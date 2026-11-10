import pdfmake from "pdfmake-rtl/js/index.js";
import { CAIRO_REGULAR_BASE64, CAIRO_BOLD_BASE64 } from "./pdf-fonts";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { questions, quizAttempts, studentAnswers, teachers } from "@/db/schema";
import { LESSON, SLIDES } from "./content";
import { humanizeResponse } from "./grading";
import { isStruggling, loadTeacherData, type StudentRow } from "./teacher-data";

let fontsReady = false;
function fonts() {
  if (!fontsReady) {
    pdfmake.virtualfs.writeFileSync("Cairo-Regular.ttf", Buffer.from(CAIRO_REGULAR_BASE64, "base64"));
    pdfmake.virtualfs.writeFileSync("Cairo-Bold.ttf", Buffer.from(CAIRO_BOLD_BASE64, "base64"));
    pdfmake.addFonts({ Cairo: { normal: "Cairo-Regular.ttf", bold: "Cairo-Bold.ttf", italics: "Cairo-Regular.ttf", bolditalics: "Cairo-Bold.ttf" } });
    fontsReady = true;
  }
}
const C = { teal: "#178b8b", dark: "#174a4b", blue: "#1e6fd9", orange: "#f7931e", green: "#22a06b", rose: "#e11d48", amber: "#b45309", slate: "#64748b", light: "#f1fafa" };
const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const date = (d: Date | string | null) => { if (!d) return "—"; const x = new Date(d); return `${x.getUTCDate()} ${months[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
const pct = (n: number | null) => n === null ? "—" : `${Math.round(n)}%`;
const scoreColor = (n: number | null, pass: number) => n === null ? C.slate : n >= pass ? C.green : n >= 50 ? C.orange : C.rose;
function status(s: StudentRow, pass: number) { if (s.certificateSerial) return "شهادة صادرة"; if (s.pendingReview) return "بانتظار التصحيح"; if (s.currentSlide === null) return "لم يبدأ"; return isStruggling(s, pass) ? "يحتاج متابعة" : "مستمر"; }
function banner(title: string, subtitle: string) {
  return {
    table: { widths: ["*"], body: [[{ stack: [{ text: LESSON.school, fontSize: 10, color: "#d4f7f4" }, { text: title, fontSize: 24, bold: true, color: "#ffffff", margin: [0, 4, 0, 4] }, { text: subtitle, fontSize: 11, color: "#effcfb" }], fillColor: C.teal, margin: [16, 14, 16, 14] }]] },
    layout: "noBorders", margin: [0, 0, 0, 12],
  };
}
function cards(items: { label: string; value: string; color: string }[]) {
  return { columns: items.map((item) => ({ table: { widths: ["*"], body: [[{ stack: [{ text: item.value, fontSize: 22, bold: true, color: "#ffffff", alignment: "center" }, { text: item.label, fontSize: 9, color: "#ffffff", alignment: "center" }], fillColor: item.color, margin: [8, 10, 8, 10] }]] }, layout: "noBorders", margin: [3, 0, 3, 10] })) };
}
function table(body: unknown[][], widths: (string | number)[], headerRows = 1) {
  return { table: { headerRows, widths, body, dontBreakRows: true }, layout: { fillColor: (row: number) => row < headerRows ? C.dark : row % 2 === 0 ? C.light : "#ffffff", hLineColor: () => "#d7e8e8", vLineColor: () => "#d7e8e8", paddingTop: () => 5, paddingBottom: () => 5 }, fontSize: 9, margin: [0, 0, 0, 14] };
}
const th = (text: string) => ({ text, bold: true, color: "#ffffff", alignment: "right" });
const cell = (text: string, color: string, bold = true) => ({ text, color, bold, alignment: "right" });
function skillBar(skill: string, earned: number, max: number) {
  const value = max ? Math.max(0, Math.min(100, (earned / max) * 100)) : 0;
  const color = value >= 80 ? C.green : value >= 50 ? C.orange : C.rose;
  return { columns: [{ text: skill, width: "*", bold: true, fontSize: 10 }, { canvas: [{ type: "rect", x: 0, y: 0, w: 170, h: 9, r: 4, color: "#e2e8f0" }, { type: "rect", x: 0, y: 0, w: Math.max(2, 170 * value / 100), h: 9, r: 4, color }], width: 175 }, { text: `${earned}/${max} · ${Math.round(value)}%`, width: 75, fontSize: 9, color }], margin: [0, 3, 0, 3] };
}
function base(content: unknown[], landscape: boolean, title: string) {
  fonts();
  return { pageSize: "A4", pageOrientation: landscape ? "landscape" : "portrait", pageMargins: [34, 28, 34, 42], rtl: true, info: { title, author: LESSON.teacher, subject: LESSON.title }, defaultStyle: { font: "Cairo", fontSize: 10, alignment: "right", color: "#17343a" }, styles: { section: { fontSize: 14, bold: true, color: C.teal, margin: [0, 10, 0, 8] } }, footer: (current: number, count: number) => ({ columns: [{ text: LESSON.school, fontSize: 8, color: C.slate, alignment: "right" }, { text: `صفحة ${current} من ${count}`, fontSize: 8, color: C.slate, alignment: "left" }], margin: [34, 10, 34, 0] }), content };
}

export async function buildClassReport(teacherId: number, classroomId?: number) {
  const data = await loadTeacherData(teacherId);
  const [teacher] = await db.select().from(teachers).where(eq(teachers.id, teacherId)).limit(1);
  const room = data.rooms.find((r) => r.id === classroomId);
  if (classroomId && !room) throw new Error("الفصل غير موجود");
  const list = data.students.filter((s) => !classroomId || s.classroomId === classroomId);
  const attempted = list.filter((s) => s.bestPercent !== null);
  const avg = attempted.length ? attempted.reduce((a, s) => a + (s.bestPercent ?? 0), 0) / attempted.length : 0;
  const passed = attempted.filter((s) => (s.bestPercent ?? 0) >= data.passPercent).length;
  const content: unknown[] = [
    banner("تقرير نتائج الطلاب", `${room ? `الفصل: ${room.name}` : "جميع الفصول"} — ${LESSON.title} — المعلم: ${teacher?.name ?? LESSON.teacher} — ${date(new Date())}`),
    cards([
      { label: "إجمالي الطلاب", value: String(list.length), color: C.teal },
      { label: "متوسط الاختبار", value: pct(attempted.length ? avg : null), color: C.blue },
      { label: "اجتازوا التقويم", value: `${passed}/${attempted.length}`, color: C.green },
      { label: "شهادات صادرة", value: String(list.filter((s) => s.certificateSerial).length), color: C.orange },
      { label: "بانتظار التصحيح", value: String(list.filter((s) => s.pendingReview).length), color: C.rose },
    ]),
    { text: `نسبة النجاح المعتمدة: ${data.passPercent}% — البيانات مقروءة من قاعدة بيانات الدرس الفعلية.`, fontSize: 9, color: C.slate, margin: [0, 0, 0, 10] },
    table([[th("الطالب"), th("الفصل"), th("الإكمال"), th("أفضل نتيجة"), th("المحاولات"), th("النقاط"), th("الحالة"), th("آخر نشاط")], ...list.map((s) => [s.name, s.classroom, `${s.completedSlides.length}/${SLIDES.length}`, cell(pct(s.bestPercent), scoreColor(s.bestPercent, data.passPercent)), String(s.attempts), String(s.points), cell(status(s, data.passPercent), s.certificateSerial ? C.green : s.pendingReview ? C.amber : isStruggling(s, data.passPercent) ? C.rose : C.teal), date(s.updatedAt)])], ["*", 72, 52, 62, 50, 45, 82, 70]),
    { text: "ملاحظة: النسبة النهائية للأسئلة الكتابية لا تكتمل حتى يعتمدها المعلم. علامة «—» تعني عدم وجود محاولة اختبار بعد.", fontSize: 9, color: C.amber },
  ];
  if (!list.length) content.splice(2, 0, { text: "لا يوجد طلاب مسجلون في هذا النطاق حاليًا.", bold: true, color: C.slate });
  return pdfmake.createPdf(base(content, true, `تقرير نتائج ${room?.name ?? "جميع الفصول"}`)).getBuffer();
}

export async function buildStudentReport(teacherId: number, studentId: number) {
  const data = await loadTeacherData(teacherId);
  const s = data.students.find((x) => x.id === studentId);
  if (!s) throw new Error("الطالب غير موجود");
  const [attempts, answers, qs, teacherRows] = await Promise.all([
    db.select().from(quizAttempts).where(and(eq(quizAttempts.studentId, studentId), eq(quizAttempts.lessonId, data.lessonId))).orderBy(asc(quizAttempts.attemptNumber)),
    db.select().from(studentAnswers).where(and(eq(studentAnswers.studentId, studentId), eq(studentAnswers.lessonId, data.lessonId))).orderBy(asc(studentAnswers.createdAt)),
    db.select().from(questions).where(eq(questions.lessonId, data.lessonId)),
    db.select().from(teachers).where(eq(teachers.id, teacherId)).limit(1),
  ]);
  const teacher = teacherRows[0];
  const qmap = new Map(qs.map((q) => [q.id, q]));
  const best = attempts.length ? attempts.reduce((a, b) => a.percent >= b.percent ? a : b) : null;
  const content: unknown[] = [
    banner(`تقرير الطالب: ${s.name}`, `${s.classroom} — ${LESSON.title} — المعلم: ${teacher?.name ?? LESSON.teacher} — ${date(new Date())}`),
    cards([
      { label: "أفضل نتيجة", value: pct(s.bestPercent), color: scoreColor(s.bestPercent, data.passPercent) },
      { label: "إكمال المحطات", value: `${s.completionPct}%`, color: C.blue },
      { label: "النقاط", value: String(s.points), color: C.teal },
      { label: "النجوم", value: String(s.stars), color: C.orange },
    ]),
    table([[th("الحالة"), th("تاريخ التسجيل"), th("الشهادة"), th("محطات متخطاة")], [cell(status(s, data.passPercent), s.certificateSerial ? C.green : C.teal), date(s.createdAt), s.certificateSerial ?? "لم تصدر", String(s.skippedSlides.length)]], ["*", "*", "*", "*"]),
    { text: "محاولات التقويم الختامي", style: "section" },
  ];
  content.push(attempts.length ? table([[th("المحاولة"), th("الدرجة الآلية"), th("الكتابي"), th("النسبة"), th("الحالة"), th("التاريخ")], ...attempts.map((a) => [String(a.attemptNumber), `${a.autoScore}/${a.maxAutoScore}`, `${a.teacherScore}/${a.maxTeacherScore}`, cell(pct(a.percent), scoreColor(a.percent, data.passPercent)), a.pendingReview ? "بانتظار التصحيح" : "مكتملة", date(a.submittedAt)])], ["*", "*", "*", "*", "*", "*"]) : { text: "لم يؤدِّ الطالب التقويم الختامي بعد.", color: C.slate });
  if (best) {
    content.push({ text: "مؤشرات المهارات في أفضل محاولة", style: "section" });
    for (const [skill, v] of Object.entries(best.skillReport)) content.push(skillBar(skill, v.earned, v.max));
    const weak = Object.entries(best.skillReport).filter(([, v]) => v.max && v.earned / v.max < 0.7).map(([skill]) => skill);
    content.push({ text: weak.length ? `توصية: مراجعة ${weak.join("، ")}.` : "أداء جيد في المهارات المقيسة.", fontSize: 10, bold: true, color: weak.length ? C.amber : C.green, margin: [0, 6, 0, 8] });
  }
  content.push({ text: "خريطة المحطات", style: "section" });
  content.push(table([[th("المحطة"), th("الحالة")], ...SLIDES.map((slide) => [slide.title, s.completedSlides.includes(slide.key) ? cell("مكتملة", C.green) : s.skippedSlides.includes(slide.key) ? cell("متخطاة مؤقتًا", C.amber) : cell("لم تكتمل", C.slate)])], ["*", 110]));
  const written = answers.filter((a) => a.needsReview);
  if (written.length) {
    content.push({ text: "الإجابات الكتابية وتصحيح المعلم", style: "section" });
    for (const a of written) {
      const q = a.questionId ? qmap.get(a.questionId) : undefined;
      content.push({ text: q?.prompt ?? `سؤال #${a.questionId}`, bold: true, fontSize: 10, margin: [0, 5, 0, 3] }, { text: `الإجابة: ${q ? humanizeResponse(q.kind, q.options, a.answer) : String(a.answer)}`, fontSize: 9, margin: [0, 0, 0, 3] }, { text: a.teacherScore === null ? "الحالة: بانتظار تصحيح المعلم" : `درجة المعلم: ${a.teacherScore}/${a.maxScore}${a.teacherFeedback ? ` — ${a.teacherFeedback}` : ""}`, fontSize: 9, color: a.teacherScore === null ? C.amber : C.green, margin: [0, 0, 0, 7] });
    }
  }
  content.push({ text: "هذا التقرير مخصص للمعلم وليس شهادة اجتياز. الشهادة تصدر فقط بعد استيفاء شروط الدرس.", fontSize: 8, color: C.slate, margin: [0, 12, 0, 0] });
  return pdfmake.createPdf(base(content, false, `تقرير الطالب ${s.name}`)).getBuffer();
}
