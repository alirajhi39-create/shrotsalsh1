import TeacherApp from "@/components/teacher/TeacherApp";

export const dynamic = "force-dynamic";

/** شاشة الدخول جزء من التطبيق نفسه، فلا يحدث انتقال يفقد رمز الجلسة */
export default function Page() {
  return <TeacherApp initialTab="overview" />;
}
