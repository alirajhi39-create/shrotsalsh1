import { teacherSessionFromRequest } from "@/lib/auth";
import { loadTeacherData, isStruggling, type StudentRow } from "@/lib/teacher-data";
import { SLIDES, SKILLS, LESSON } from "@/lib/content";

export const dynamic = "force-dynamic";

/** تقرير A4 عربي بسيط قابل للطباعة/الحفظ كـPDF من المتصفح (بدون مكتبات خارجية) */
function esc(s: string) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET(req: Request) {
  const session = await teacherSessionFromRequest(req);
  if (!session) return new Response("غير مصرح", { status: 401 });

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") === "students" ? "students" : "overview";
  const classroomId = Number(url.searchParams.get("classroomId") || 0);

  const data = await loadTeacherData(session.teacherId);
  const list: StudentRow[] = (classroomId ? data.students.filter((s) => s.classroomId === classroomId) : data.students).slice();
  const roomName = classroomId ? data.rooms.find((r) => r.id === classroomId)?.name ?? "" : "جميع الفصول";

  const started = data.students.filter((s) => s.completedSlides.length > 0 || s.currentSlide);
  const withAttempt = data.students.filter((s) => s.bestPercent !== null);
  const avg = withAttempt.length ? withAttempt.reduce((a, s) => a + (s.bestPercent ?? 0), 0) / withAttempt.length : 0;
  const passed = withAttempt.filter((s) => (s.bestPercent ?? 0) >= data.passPercent).length;
  const finished = data.students.filter((s) => s.completedAt);
  const certified = data.students.filter((s) => s.certificateSerial).length;
  const struggling = list.filter((s) => isStruggling(s, data.passPercent));

  const stationData = SLIDES.map((s) => ({
    title: s.title,
    count: data.students.filter((x) => x.completedSlides.includes(s.key)).length,
  }));
  const skillData = SKILLS.map((sk) => ({ skill: sk, count: data.students.filter((x) => x.weakSkills.includes(sk)).length }));

  const bar = (v: number, max: number, color: string) => {
    const pct = max ? Math.min(100, Math.round((v / max) * 100)) : 0;
    return `<div class="bar"><i style="width:${pct}%;background:${color}"></i><b>${pct}%</b></div>`;
  };

  const studentRows = list
    .map(
      (s, i) => `<tr>
      <td class="c">${i + 1}</td>
      <td class="b">${esc(s.name)}</td><td>${esc(s.classroom)}</td>
      <td class="c mono">${esc(s.resumeCode)}</td>
      <td>${bar(s.completionPct, 100, "#1fadab")}</td>
      <td class="c">${s.points}</td><td class="c">${s.stars}</td>
      <td class="c">${s.bestPercent === null ? "—" : Math.round(s.bestPercent) + "%"}</td>
      <td class="c">${s.attempts}</td>
      <td class="c">${s.certificateSerial ? "✓" : "—"}</td>
      <td>${s.weakSkills.length ? esc(s.weakSkills.join("، ")) : "—"}</td>
    </tr>`,
    )
    .join("");

  const stationRows = stationData
    .map((s) => `<tr><td class="b">${esc(s.title)}</td><td class="c">${s.count}</td><td>${bar(s.count, Math.max(1, started.length), "#1e6fd9")}</td></tr>`)
    .join("");

  const skillRows = skillData
    .map((s) => `<tr><td class="b">${esc(s.skill)}</td><td class="c">${s.count}</td><td>${bar(s.count, Math.max(1, data.students.length), "#f7931e")}</td></tr>`)
    .join("");

  const struggleRows = struggling.length
    ? struggling
        .map(
          (s) =>
            `<tr><td class="b">${esc(s.name)}</td><td>${esc(s.classroom)}</td><td class="c">${s.completionPct}%</td><td class="c">${
              s.bestPercent === null ? "—" : Math.round(s.bestPercent) + "%"
            }</td><td>${esc(s.weakSkills.join("، ") || "—")}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="5" class="c muted">لا يوجد طلاب متعثرون 🎉</td></tr>`;

  const statsGrid = `
    <div class="cards">
      <div class="card"><span>إجمالي الطلاب</span><b>${data.students.length}</b></div>
      <div class="card"><span>بدؤوا الدرس</span><b>${started.length}</b></div>
      <div class="card"><span>متوسط الاختبار</span><b>${Math.round(avg)}%</b></div>
      <div class="card"><span>اجتازوا (${data.passPercent}%)</span><b>${passed}/${withAttempt.length}</b></div>
      <div class="card"><span>أكملوا الدرس</span><b>${finished.length}</b></div>
      <div class="card"><span>شهادات صادرة</span><b>${certified}</b></div>
    </div>`;

  const studentsTable = `
    <h2>تفاصيل الطلاب (${list.length})</h2>
    <table>
      <thead><tr><th>#</th><th>الطالب</th><th>الفصل</th><th>رمز الاستكمال</th><th>الإكمال</th><th>النقاط</th><th>النجوم</th><th>الاختبار</th><th>المحاولات</th><th>الشهادة</th><th>مهارات للمراجعة</th></tr></thead>
      <tbody>${studentRows || `<tr><td colspan="11" class="c muted">لا يوجد طلاب بعد</td></tr>`}</tbody>
    </table>`;

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>${kind === "students" ? "تقرير نتائج الطلاب" : "التقرير العام"} — ${esc(LESSON.title)}</title>
<style>
  @page { size: A4 ${kind === "students" ? "landscape" : "portrait"}; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Cairo","Tajawal","Segoe UI",sans-serif; color:#0f2a2a; margin:0; padding:16px; background:#fff; }
  header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1fadab; padding-bottom:10px; margin-bottom:14px; }
  header h1 { margin:0; font-size:20px; color:#176f70; }
  header p { margin:2px 0; font-size:11px; color:#5b7474; }
  .badge { background:#fff4e5; color:#b96a00; border:1px solid #f5c98a; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700; }
  h2 { font-size:15px; color:#176f70; margin:18px 0 8px; border-inline-start:4px solid #f7931e; padding-inline-start:8px; }
  .cards { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; }
  .card { border:1px solid #d9ecec; border-radius:10px; padding:8px; text-align:center; }
  .card span { display:block; font-size:10px; color:#5b7474; }
  .card b { font-size:16px; color:#176f70; }
  table { width:100%; border-collapse:collapse; font-size:10.5px; }
  th { background:#eaf7f7; color:#176f70; padding:6px 4px; border:1px solid #cfe9e9; font-size:10px; }
  td { padding:5px 4px; border:1px solid #e3eeee; vertical-align:top; }
  tr:nth-child(even) td { background:#fbfefe; }
  .c { text-align:center; } .b { font-weight:700; } .mono { font-family:monospace; letter-spacing:1px; color:#b96a00; }
  .muted { color:#8aa0a0; }
  .bar { position:relative; min-width:90px; height:14px; background:#eef7f7; border-radius:999px; overflow:hidden; }
  .bar i { position:absolute; inset-block:0; inset-inline-start:0; border-radius:999px; }
  .bar b { position:absolute; inset-inline-end:4px; top:-1px; font-size:9px; color:#0f2a2a; }
  footer { margin-top:16px; padding-top:8px; border-top:1px solid #e3eeee; font-size:10px; color:#8aa0a0; display:flex; justify-content:space-between; }
  .no-print { margin-bottom:12px; }
  button { background:#1fadab; color:#fff; border:0; border-radius:10px; padding:10px 18px; font-size:14px; font-weight:700; cursor:pointer; font-family:inherit; }
  @media print { .no-print { display:none; } body { padding:0; } }
</style></head><body>
  <div class="no-print"><button onclick="window.print()">🖨️ طباعة / حفظ كـ PDF</button></div>
  <header>
    <div>
      <h1>${kind === "students" ? "تقرير نتائج الطلاب" : "التقرير العام للدرس"}</h1>
      <p>${esc(LESSON.subject)} — ${esc(LESSON.grade)} — الدرس ${LESSON.lessonNumber}: ${esc(LESSON.title)} (ص ${LESSON.pages})</p>
      <p>${esc(LESSON.school)} — المعلم: ${esc(LESSON.teacher)} — الفصل: ${esc(roomName)}</p>
    </div>
    <div style="text-align:left">
      <div class="badge">تاريخ التقرير: ${new Date().toLocaleDateString("ar-SA-u-ca-gregory")}</div>
      <p style="margin-top:6px">${new Date().toLocaleString("ar-SA")}</p>
    </div>
  </header>
  ${statsGrid}
  <h2>نسبة إكمال كل محطة</h2>
  <table><thead><tr><th>المحطة</th><th>عدد الطلاب</th><th>النسبة</th></tr></thead><tbody>${stationRows}</tbody></table>
  <h2>المهارات التي تحتاج مراجعة</h2>
  <table><thead><tr><th>المهارة</th><th>عدد الطلاب</th><th>النسبة</th></tr></thead><tbody>${skillRows}</tbody></table>
  <h2>الطلاب المتعثرون (${struggling.length})</h2>
  <table><thead><tr><th>الطالب</th><th>الفصل</th><th>الإكمال</th><th>الاختبار</th><th>مهارات للمراجعة</th></tr></thead><tbody>${struggleRows}</tbody></table>
  ${kind === "students" ? studentsTable : ""}
  <footer><span>${esc(LESSON.school)} — ${esc(LESSON.teacher)}</span><span>تم توليد التقرير من منصة درس «شروط الصلاة (1)» التفاعلية</span></footer>
  <script>window.addEventListener("load",function(){setTimeout(function(){window.print()},400)});</script>
</body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
