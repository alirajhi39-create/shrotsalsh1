import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { isStruggling, loadTeacherData } from "@/lib/teacher-data";
import { SLIDES, SKILLS } from "@/lib/content";
import { BarChart, ColumnChart, Donut, StatCard } from "@/components/teacher/charts";
import { PrintPageButton } from "@/components/teacher/forms";

export const dynamic = "force-dynamic";

export default async function TeacherOverview() {
  const session = await requireTeacher();
  const data = await loadTeacherData(session.teacherId);
  const { students, passPercent, rooms } = data;

  const started = students.filter((s) => s.completedSlides.length > 0 || s.currentSlide);
  const finished = students.filter((s) => s.completedAt);
  const withAttempt = students.filter((s) => s.bestPercent !== null);
  const avg = withAttempt.length ? withAttempt.reduce((a, s) => a + (s.bestPercent ?? 0), 0) / withAttempt.length : 0;
  const passed = withAttempt.filter((s) => (s.bestPercent ?? 0) >= passPercent).length;
  const certified = students.filter((s) => s.certificateSerial).length;
  const struggling = students.filter((s) => isStruggling(s, passPercent));

  const base = Math.max(1, started.length);
  const stationData = SLIDES.map((s) => ({
    label: s.title,
    value: (students.filter((st) => st.completedSlides.includes(s.key)).length / base) * 100,
  }));

  const classData = rooms.map((r) => {
    const mine = students.filter((s) => s.classroomId === r.id && s.bestPercent !== null);
    return {
      label: r.name,
      value: mine.length ? mine.reduce((a, s) => a + (s.bestPercent ?? 0), 0) / mine.length : 0,
      color: "#1fadab",
    };
  });

  const skillCounts = SKILLS.map((sk) => ({
    label: sk,
    value: students.filter((s) => s.weakSkills.includes(sk)).length,
    color: "#f7931e",
  }));

  const dist = [
    { label: "أقل من 50", value: withAttempt.filter((s) => (s.bestPercent ?? 0) < 50).length, color: "#f43f5e" },
    { label: "50–79", value: withAttempt.filter((s) => (s.bestPercent ?? 0) >= 50 && (s.bestPercent ?? 0) < 80).length, color: "#f7931e" },
    { label: "80–100", value: withAttempt.filter((s) => (s.bestPercent ?? 0) >= 80).length, color: "#22a06b" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-turq-900">النظرة العامة</h1>
          <p className="text-slate-500">متابعة مباشرة لنتائج درس «شروط الصلاة (1)» — تُحدَّث البيانات مع كل تحميل للصفحة.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintPageButton />
          <a href="/api/teacher/export?format=xlsx" className="rounded-2xl bg-brand-green px-4 py-2 font-bold text-white shadow hover:brightness-110">
            ⬇️ Excel
          </a>
          <a href="/api/teacher/export?format=csv" className="rounded-2xl bg-turq-600 px-4 py-2 font-bold text-white shadow hover:bg-turq-700">
            ⬇️ CSV
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="إجمالي الطلاب" value={students.length} hint={`${rooms.length} فصول`} icon="🧑‍🎓" />
        <StatCard title="بدؤوا الدرس" value={started.length} hint={`${students.length ? Math.round((started.length / students.length) * 100) : 0}% من الطلاب`} icon="🚀" tone="blue" />
        <StatCard title="متوسط الاختبار" value={`${Math.round(avg)}%`} hint={`${passed} اجتازوا من ${withAttempt.length}`} icon="📝" tone="orange" />
        <StatCard title="أكملوا الدرس" value={finished.length} hint={`${certified} شهادة صادرة`} icon="🎓" tone="green" />
        <StatCard title="بانتظار التصحيح" value={data.pendingReviewCount} hint="إجابات كتابية" icon="⏳" tone="rose" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-4 text-xl font-black text-turq-900">نسبة إكمال كل محطة</h2>
          <BarChart data={stationData} />
        </section>
        <section className="space-y-6">
          <div className="rounded-3xl bg-white p-5 shadow">
            <h2 className="mb-4 text-xl font-black text-turq-900">مقارنة متوسط الاختبار بين الفصول</h2>
            <ColumnChart data={classData} />
          </div>
          <div className="grid gap-4 rounded-3xl bg-white p-5 shadow sm:grid-cols-2">
            <Donut percent={students.length ? (finished.length / students.length) * 100 : 0} label="نسبة إكمال الدرس" />
            <Donut percent={withAttempt.length ? (passed / withAttempt.length) * 100 : 0} label={`نسبة الاجتياز (${passPercent}%)`} color="#1e6fd9" />
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-4 text-xl font-black text-turq-900">توزيع درجات الاختبار</h2>
          <ColumnChart data={dist} max={Math.max(1, withAttempt.length)} suffix="" />
        </section>
        <section className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-4 text-xl font-black text-turq-900">المهارات التي يحتاجها الطلاب للمراجعة</h2>
          <BarChart data={skillCounts} max={Math.max(1, students.length)} suffix=" طالب" />
        </section>
      </div>

      <section className="rounded-3xl bg-white p-5 shadow">
        <h2 className="mb-1 text-xl font-black text-turq-900">الطلاب المتعثرون ({struggling.length})</h2>
        <p className="mb-4 text-sm text-slate-500">لم يصلوا إلى نسبة النجاح، أو لديهم مهارات ضعيفة، أو توقفوا عن التقدم لأكثر من أسبوع.</p>
        {struggling.length === 0 ? (
          <p className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-800">لا يوجد طلاب متعثرون حاليًا 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="p-2 text-start">الطالب</th>
                  <th className="p-2 text-start">الفصل</th>
                  <th className="p-2">الإكمال</th>
                  <th className="p-2">أفضل نتيجة</th>
                  <th className="p-2 text-start">مهارات للمراجعة</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {struggling.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="p-2 font-bold">{s.name}</td>
                    <td className="p-2">{s.classroom}</td>
                    <td className="p-2 text-center">{s.completionPct}%</td>
                    <td className="p-2 text-center">{s.bestPercent === null ? "—" : `${Math.round(s.bestPercent)}%`}</td>
                    <td className="p-2">{s.weakSkills.join("، ") || "—"}</td>
                    <td className="p-2">
                      <Link href={`/teacher/students/${s.id}`} className="font-bold text-turq-700 hover:underline">
                        عرض
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow">
        <h2 className="mb-3 text-xl font-black text-turq-900">آخر نشاط للطلاب</h2>
        {data.recent.length === 0 ? (
          <p className="text-sm text-slate-500">لا يوجد نشاط بعد.</p>
        ) : (
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {data.recent.map((r) => {
              const st = students.find((s) => s.id === r.actorId);
              const labels: Record<string, string> = {
                student_created: "سجّل في الدرس",
                student_resumed: "عاد لمتابعة الدرس",
                quiz_submitted: "أرسل اختبارًا",
                certificate_issued: "حصل على الشهادة",
                audio_uploaded: "رفع تسجيلًا صوتيًا",
                resume_code_failed: "أدخل رمز استكمال خاطئ",
              };
              return (
                <li key={r.id} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span>
                    <b>{st?.name ?? `طالب #${r.actorId}`}</b> — {labels[r.action] ?? r.action}
                  </span>
                  <span className="text-slate-500">{new Date(r.createdAt).toLocaleString("ar-SA")}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
