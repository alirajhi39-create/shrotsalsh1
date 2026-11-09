import { requireTeacher } from "@/lib/auth";
import BoardGame from "@/components/teacher/BoardGame";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  await requireTeacher();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-black text-turq-900">نشاط السبورة الذكية (جماعي)</h1>
        <p className="text-slate-500">
          وضع تعاوني يعمل بدون حساب طالب: قسّم الصف إلى فريقين، واعرض البطاقة على السبورة، ويختار كل فريق بدوره الشرط الصحيح. يُفضّل تكبير الشاشة (F11).
        </p>
      </div>
      <BoardGame />
    </div>
  );
}
