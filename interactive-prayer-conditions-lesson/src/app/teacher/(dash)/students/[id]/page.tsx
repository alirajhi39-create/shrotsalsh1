import TeacherApp from "@/components/teacher/TeacherApp";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  return <TeacherApp initialTab="students" initialStudentId={Number.isInteger(id) ? id : undefined} />;
}
