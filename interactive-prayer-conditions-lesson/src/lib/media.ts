import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { ensureSeeded } from "./seed";
import { AUDIO_SLOTS, IMAGE_SLOTS } from "./media-catalog";

export type MediaItem = { kind: string; dataUrl: string; mime: string; altText: string; title: string; updatedAt: string };
export type MediaMap = Record<string, MediaItem>;

/** يقرأ وسائط المعلم مباشرة من قاعدة البيانات (تُستخدم في مكونات الخادم) */
export async function getMediaMap(slots?: string[]): Promise<MediaMap> {
  try {
    const lessonId = await ensureSeeded();
    const allowed = new Set<string>([...IMAGE_SLOTS.map((s) => s.key), ...AUDIO_SLOTS.map((s) => s.key)]);
    const requested = (slots ?? []).filter((s) => allowed.has(s));
    if (requested.length === 0) return {};
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
      .where(and(eq(mediaAssets.lessonId, lessonId), eq(mediaAssets.active, true)));
    const map: MediaMap = {};
    for (const r of rows) {
      if (!requested.includes(r.slot)) continue;
      map[r.slot] = {
        kind: r.kind,
        dataUrl: r.dataUrl,
        mime: r.mime,
        altText: r.altText,
        title: r.title,
        updatedAt: r.updatedAt.toISOString(),
      };
    }
    return map;
  } catch {
    return {};
  }
}
