import Journey from "@/components/lesson/Journey";

export const dynamic = "force-dynamic";

/**
 * التحقق من الجلسة يتم في المكوّن العميل (Journey) عبر الكوكي أو الرمز الاحتياطي المحفوظ
 * في المتصفح؛ وعند عدم وجود جلسة صالحة يُعاد الطالب إلى صفحة الاستقبال.
 */
export default function LessonPage() {
  return <Journey />;
}
