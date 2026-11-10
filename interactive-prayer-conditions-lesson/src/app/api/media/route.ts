import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { AUDIO_SLOTS, IMAGE_SLOTS } from "@/lib/media-catalog";

export const dynamic = "force-dynamic";

/**
 * وسائط العرض العامة (صور/أصوات) التي عدّلها المعلم.
 * متاحة لكل الأجهزة بدون جلسة، وتُقيَّد بمفاتيح مواضع معروفة فقط.
 */
export async function GET(req: NextRequest) {
  try {
    const lessonId = await ensureSeeded();
    const slotsParam = req.nextUrl.searchParams.get("slots");
    const allowed = new Set<string>([...IMAGE_SLOTS.map((s) => s.key), ...AUDIO_SLOTS.map((s) => s.key)]);
    const requested = slotsParam
      ? slotsParam.split(",").map((s) => s.trim()).filter((s) => allowed.has(s))
      : Array.from(allowed);

    if (!requested.length) return NextResponse.json({ media: {} });

    const rows = await db
      .select({
        slot: mediaAssets.slot,
        kind: mediaAssets.kind,
        dataUrl: mediaAssets.dataUrl,
        mime: mediaAssets.mime,
        altText: mediaAssets.altText,
        title: mediaAssets.title,
        updatedAt: mediaAssets.updatedAt,
      })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.lessonId, lessonId), eq(mediaAssets.active, true), inArray(mediaAssets.slot, requested)));

    const media: Record<string, { kind: string; dataUrl: string; mime: string; altText: string; title: string; updatedAt: string }> = {};
    for (const r of rows) {
      media[r.slot] = {
        kind: r.kind,
        dataUrl: r.dataUrl,
        mime: r.mime,
        altText: r.altText,
        title: r.title,
        updatedAt: r.updatedAt.toISOString(),
      };
    }
    return NextResponse.json({ media });
  } catch (err) {
    console.error("media GET error", err);
    return NextResponse.json({ media: {} });
  }
}

