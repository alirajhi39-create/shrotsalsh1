import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { audioRecordings } from "@/db/schema";
import { getTeacherSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getTeacherSession();
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id } = await ctx.params;
  const recId = Number(id);
  if (!Number.isInteger(recId)) return NextResponse.json({ error: "معرف غير صالح" }, { status: 400 });
  const [rec] = await db.select().from(audioRecordings).where(eq(audioRecordings.id, recId)).limit(1);
  if (!rec) return NextResponse.json({ error: "التسجيل غير موجود" }, { status: 404 });
  const bytes = Buffer.from(rec.dataBase64, "base64");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": rec.mimeType,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
