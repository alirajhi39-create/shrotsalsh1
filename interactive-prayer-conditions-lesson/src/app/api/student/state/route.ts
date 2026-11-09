import { NextResponse } from "next/server";
import { buildStudentState, getStudentFromCookie } from "@/lib/student";

export const dynamic = "force-dynamic";

export async function GET() {
  const student = await getStudentFromCookie();
  if (!student) return NextResponse.json({ error: "لا توجد جلسة طالب" }, { status: 401 });
  const state = await buildStudentState(student);
  return NextResponse.json({ state });
}
