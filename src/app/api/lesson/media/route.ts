import { NextResponse } from "next/server";
import { getPublishedMedia } from "@/lib/media-server";
import { EMPTY_MEDIA } from "@/lib/media";

export const dynamic = "force-dynamic";

/** بيانات الوسائط المنشورة فقط؛ لا يتضمن ملفات الطلاب أو بيانات اعتماد المعلم. */
export async function GET() {
  try {
    const media = await getPublishedMedia();
    return NextResponse.json({ ok: true, media }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, media: EMPTY_MEDIA, error: "تعذر تحديث الوسائط؛ ستبقى النسخة السابقة متاحة." }, { headers: { "Cache-Control": "no-store" } });
  }
}
