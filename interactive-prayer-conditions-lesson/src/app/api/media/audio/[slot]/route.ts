import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { AUDIO_SLOTS } from "@/lib/media-catalog";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

/** بث مقطع صوتي أضافه المعلم — متاح لجميع الأجهزة بدون جلسة */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slot: string }> }) {
  try {
    const { slot } = await ctx.params;
    if (!AUDIO_SLOTS.some((a) => a.key === slot)) {
      return NextResponse.json({ error: "موضع صوتي غير معروف" }, { status: 400 });
    }
    const lessonId = await ensureSeeded();
    const [row] = await db
      .select({ dataUrl: mediaAssets.dataUrl, mime: mediaAssets.mime })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.lessonId, lessonId), eq(mediaAssets.slot, slot), eq(mediaAssets.active, true)))
      .limit(1);
    if (!row) return NextResponse.json({ error: "لا يوجد مقطع صوتي" }, { status: 404 });

    const base64 = row.dataUrl.includes(",") ? row.dataUrl.split(",")[1] : row.dataUrl;
    const bytes = Buffer.from(base64, "base64");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": row.mime || "audio/webm",
        "Content-Length": String(bytes.length),
        "Cache-Control": "public, max-age=60",
        "Accept-Ranges": "none",
      },
    });
  } catch (err) {
    console.error("media audio error", err);
    return NextResponse.json({ error: "تعذر تحميل المقطع الصوتي" }, { status: 500 });
  }
}
