import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { isStruggling, loadTeacherData } from "@/lib/teacher-data";
import { SLIDES } from "@/lib/content";
import { addClassroom, addStudent, deleteClassroom, toggleClassroom } from "../../actions";
import { ConfirmForm } from "@/components/teacher/forms";

export const dynamic = "force-dynamic";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ classroomId?: string }> }) {
  const session = await requireTeacher();
  const { classroomId } = await searchParams;
  const data = await loadTeacherData(session.teacherId);
  const filter = Number(classroomId || 0);
  const list = filter ? data.students.filter((s) => s.classroomId === filter) : data.students;
  const input = "rounded-xl border-2 border-slate-200 p-2 focus:border-turq-400 focus:outline-none";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black text-turq-900">الطلاب والفصول</h1>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/teacher/export?format=xlsx${filter ? `&classroomId=${filter}` : ""}`} className="rounded-2xl bg-brand-green px-4 py-2 font-bold text-white shadow">
            ⬇️ Excel
          </a>
          <a href={`/api/teacher/export?format=csv${filter ? `&classroomId=${filter}` : ""}`} className="rounded-2xl bg-turq-600 px-4 py-2 font-bold text-white shadow">
            ⬇️ CSV
          </a>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-3 text-lg font-black text-turq-900">الفصول</h2>
          <ul className="space-y-2">
            {data.rooms.map((r) => {
              const count = data.students.filter((s) => s.classroomId === r.id).length;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2">
                  <Link href={`/teacher/students?classroomId=${r.id}`} className="font-bold text-turq-800 hover:underline">
                    🏫 {r.name}
                  </Link>
                  <span className="text-sm text-slate-500">({count} طالب)</span>
                  {!r.active && <span className="rounded-full bg-rose-100 px-2 text-xs font-bold text-rose-700">موقوف</span>}
                  <div className="ms-auto flex gap-1">
                    <form action={toggleClassroom}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-700 shadow-sm">{r.active ? "إيقاف" : "تفعيل"}</button>
                    </form>
                    {count === 0 && (
                      <ConfirmForm action={deleteClassroom} hidden={{ id: r.id }} message={`حذف فصل ${r.name}؟`}>
                        <button className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">حذف</button>
                      </ConfirmForm>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <form action={addClassroom} className="mt-3 flex gap-2">
            <input name="name" required placeholder="اسم فصل جديد (مثال: الثالث (ج))" className={`${input} flex-1`} />
            <button className="rounded-xl bg-turq-600 px-4 font-bold text-white">➕ إضافة</button>
          </form>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow">
          <h2 className="mb-1 text-lg font-black text-turq-900">إضافة طالب (اسم مثبّت)</h2>
          <p className="mb-3 text-sm text-slate-500">الطالب المضاف من هنا يُثبّت اسمه وفصله، ويحصل على رمز استكمال يظهر لك بعد الإضافة.</p>
          <form action={addStudent} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input name="name" required minLength={2} placeholder="اسم الطالب" className={input} />
            <select name="classroomId" className={input} defaultValue={filter || data.rooms[0]?.id}>
              {data.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button className="rounded-xl bg-brand-orange px-4 py-2 font-bold text-white">➕ إضافة</button>
          </form>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-black text-turq-900">قائمة الطلاب ({list.length})</h2>
          <div className="ms-auto flex flex-wrap gap-1">
            <Link href="/teacher/students" className={`rounded-xl px-3 py-1 text-sm font-bold ${!filter ? "bg-turq-600 text-white" : "bg-slate-100 text-slate-700"}`}>
              الكل
            </Link>
            {data.rooms.map((r) => (
              <Link key={r.id} href={`/teacher/students?classroomId=${r.id}`} className={`rounded-xl px-3 py-1 text-sm font-bold ${filter === r.id ? "bg-turq-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                {r.name}
              </Link>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-6 text-center text-slate-500">لا يوجد طلاب بعد. سيظهر الطلاب هنا فور تسجيلهم من صفحة الاستقبال أو إضافتهم يدويًا.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="p-2 text-start">الطالب</th>
                  <th className="p-2 text-start">الفصل</th>
                  <th className="p-2">رمز الاستكمال</th>
                  <th className="p-2 text-start">المحطة الحالية</th>
                  <th className="p-2">الإكمال</th>
                  <th className="p-2">النقاط</th>
                  <th className="p-2">الاختبار</th>
                  <th className="p-2">الحالة</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-turq-50/40">
                    <td className="p-2 font-bold">
                      {s.locked && <span title="اسم مثبّت">📌 </span>}
                      {s.name}
                    </td>
                    <td className="p-2">{s.classroom}</td>
                    <td className="p-2 text-center font-mono font-bold tracking-widest text-orange-700">{s.resumeCode}</td>
                    <td className="p-2">{s.currentSlide !== null ? `${(s.currentSlide ?? 0) + 1}. ${SLIDES[s.currentSlide ?? 0]?.title ?? ""}` : "لم يبدأ"}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full bg-turq-500" style={{ width: `${s.completionPct}%` }} />
                        </div>
                        <span>{s.completionPct}%</span>
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      🏅 {s.points} ⭐ {s.stars}
                    </td>
                    <td className="p-2 text-center">{s.bestPercent === null ? "—" : `${Math.round(s.bestPercent)}% (${s.attempts})`}</td>
                    <td className="p-2 text-center">
                      {s.certificateSerial ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">🎓 شهادة</span>
                      ) : s.pendingReview ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">⏳ تصحيح</span>
                      ) : isStruggling(s, data.passPercent) ? (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">متعثر</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">مستمر</span>
                      )}
                    </td>
                    <td className="p-2">
                      <Link href={`/teacher/students/${s.id}`} className="rounded-xl bg-turq-50 px-3 py-1 font-bold text-turq-700 hover:bg-turq-100">
                        التفاصيل
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
