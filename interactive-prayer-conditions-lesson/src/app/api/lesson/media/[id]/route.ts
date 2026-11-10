import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { lessonMedia, lessons } from "@/db/schema";
import { LESSON } from "@/lib/content";

export const dynamic = "force-dynamic";

/** ملفات الدرس المنشورة عامة؛ تسجيلات الطلاب لها مسار منفصل محمي بالمعلم. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "معرف غير صالح" }, { status: 400 });
  const [row] = await db.select({ media: lessonMedia }).from(lessonMedia)
    .innerJoin(lessons, eq(lessons.id, lessonMedia.lessonId))
    .where(and(eq(lessonMedia.id, id), eq(lessons.slug, LESSON.slug), eq(lessonMedia.active, true), eq(lessonMedia.source, "uploaded")))
    .limit(1);
  const dataBase64 = row?.media.dataBase64;
  if (!dataBase64) return NextResponse.json({ error: "الوسيط غير متاح" }, { status: 404 });
  const media = row.media;
  const bytes = Buffer.from(dataBase64, "base64");
  const etag = `"media-${media.id}-${media.updatedAt.getTime()}"`;
  const headers: Record<string, string> = {
    "Content-Type": media.mimeType,
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename="lesson-media-${media.id}"`,
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: etag,
    "Accept-Ranges": "bytes",
    "Cross-Origin-Resource-Policy": "cross-origin",
  };
  if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
  const range = req.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${bytes.length}` } });
    const start = match[1] ? Number(match[1]) : Math.max(0, bytes.length - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= bytes.length) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${bytes.length}` } });
    }
    return new NextResponse(new Uint8Array(bytes.subarray(start, end + 1)), { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${bytes.length}`, "Content-Length": String(end - start + 1) } });
  }
  return new NextResponse(new Uint8Array(bytes), { headers: { ...headers, "Content-Length": String(bytes.length) } });
}
