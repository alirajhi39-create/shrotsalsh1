import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { teacherSessionFromRequest } from "@/lib/auth";
import { LiveQuizError, getLiveQuestionChoices } from "@/lib/live-quiz-server";

export const dynamic = "force-dynamic";
const schema = z.enum(["mixed", "assessment", "conditions", "najasa"]);
export async function GET(req: NextRequest) {
  const t = await teacherSessionFromRequest(req);
  if (!t) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const mode = schema.safeParse(new URL(req.url).searchParams.get("mode") ?? "mixed");
  if (!mode.success) return NextResponse.json({ error: "نوع مسابقة غير صالح" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, questions: await getLiveQuestionChoices(mode.data) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof LiveQuizError ? e.message : "تعذر تحميل الأسئلة" }, { status: e instanceof LiveQuizError ? e.status : 500 });
  }
}
