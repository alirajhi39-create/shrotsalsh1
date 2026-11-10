import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { lessonMedia, type LessonMedia } from "@/db/schema";
import { ensureSeeded } from "./seed";
import {
  AUDIO_MIME_TYPES,
  EMPTY_MEDIA,
  IMAGE_MIME_TYPES,
  IMAGE_SLOTS,
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  STATION_KEYS,
  isImageSlot,
  type ImageSlot,
  type ManagedMedia,
  type MediaCatalog,
} from "./media";

const slotKeys = IMAGE_SLOTS.map((s) => s.key) as [ImageSlot, ...ImageSlot[]];
const stationKeys = [...STATION_KEYS] as [string, ...string[]];
const metadata = {
  id: z.number().int().positive().optional(),
  title: z.string().trim().min(1, "أدخل عنوانًا").max(120),
  alt: z.string().trim().max(200).optional().default(""),
  active: z.boolean().optional().default(true),
};
const uploaded = z.object({
  ...metadata,
  source: z.literal("uploaded"),
  mimeType: z.string().max(64),
  dataBase64: z.string().min(16).max(Math.ceil(MAX_AUDIO_BYTES * 4 / 3) + 8).regex(/^[A-Za-z0-9+/]+={0,2}$/, "ملف غير صالح"),
});
const linked = z.object({
  ...metadata,
  source: z.literal("url"),
  mimeType: z.string().max(64),
  url: z.string().trim().url("أدخل رابطًا مباشرًا صحيحًا").max(1500),
});
const sourceFields = z.discriminatedUnion("source", [uploaded, linked]);
export const mediaSaveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("image"), slot: z.enum(slotKeys), fields: sourceFields }),
  z.object({ kind: z.literal("audio"), slideKey: z.enum(stationKeys), fields: sourceFields }),
]);
export const mediaChangeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete"), id: z.number().int().positive() }),
  z.object({ action: z.literal("toggle"), id: z.number().int().positive(), active: z.boolean() }),
  z.object({
    action: z.literal("updateAudio"),
    id: z.number().int().positive(),
    title: z.string().trim().min(1).max(120),
    slideKey: z.enum(stationKeys),
    active: z.boolean(),
  }),
]);
export type MediaSaveInput = z.infer<typeof mediaSaveSchema>;

function validateUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("استخدم رابط HTTPS مباشرًا بدون اسم مستخدم أو كلمة مرور");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/.test(host)) {
    throw new Error("لا يمكن استخدام روابط محلية أو شبكة داخلية");
  }
  return url.toString();
}

function validateUpload(kind: "image" | "audio", mime: string, base64: string) {
  const allowed = kind === "image" ? IMAGE_MIME_TYPES : AUDIO_MIME_TYPES;
  if (!(allowed as readonly string[]).includes(mime)) throw new Error("نوع الملف غير مدعوم");
  const bytes = Buffer.from(base64, "base64");
  const limit = kind === "image" ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
  if (!bytes.length || bytes.length > limit) throw new Error(kind === "image" ? "الحد الأقصى للصورة 2 ميغابايت" : "الحد الأقصى للمقطع 3 ميغابايت؛ استخدم رابطًا للملفات الأكبر");
  const head = bytes.subarray(0, 16);
  const text = head.toString("ascii");
  const valid = kind === "image"
    ? (mime === "image/png" && head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (mime === "image/jpeg" && head[0] === 255 && head[1] === 216 && head[2] === 255) ||
      (mime === "image/webp" && text.startsWith("RIFF") && text.slice(8, 12) === "WEBP") ||
      (mime === "image/gif" && (text.startsWith("GIF87a") || text.startsWith("GIF89a")))
    : (["audio/mpeg", "audio/mp3"].includes(mime) && (text.startsWith("ID3") || (head[0] === 255 && (head[1] & 224) === 224))) ||
      (["audio/wav", "audio/x-wav"].includes(mime) && text.startsWith("RIFF") && text.slice(8, 12) === "WAVE") ||
      (mime === "audio/ogg" && text.startsWith("OggS")) ||
      (["audio/mp4", "audio/x-m4a", "audio/aac"].includes(mime) && (text.slice(4, 8) === "ftyp" || (head[0] === 255 && (head[1] & 240) === 240))) ||
      (mime === "audio/webm" && head.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])));
  if (!valid) throw new Error("محتوى الملف لا يطابق نوعه؛ اختر صورة أو مقطعًا صوتيًا صالحًا");
  return bytes.length;
}

function mediaUrl(row: Pick<LessonMedia, "id" | "source" | "url" | "updatedAt">) {
  return row.source === "url" ? row.url! : `/api/lesson/media/${row.id}?v=${row.updatedAt.getTime()}`;
}
function managed(row: LessonMedia): ManagedMedia {
  return {
    id: row.id,
    kind: row.kind as ManagedMedia["kind"],
    slot: row.slot as ImageSlot | null,
    slideKey: row.slideKey,
    title: row.title,
    alt: row.alt,
    source: row.source as ManagedMedia["source"],
    mimeType: row.mimeType,
    src: mediaUrl(row),
    sizeBytes: row.sizeBytes,
    active: row.active,
    legacyAudioId: row.legacyAudioId,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listTeacherMedia(lessonId: number): Promise<ManagedMedia[]> {
  const rows = await db.select().from(lessonMedia).where(eq(lessonMedia.lessonId, lessonId)).orderBy(asc(lessonMedia.kind), asc(lessonMedia.orderIndex), desc(lessonMedia.updatedAt));
  return rows.map(managed);
}

export async function getPublishedMedia(): Promise<MediaCatalog> {
  const lessonId = await ensureSeeded();
  const rows = await db.select().from(lessonMedia).where(and(eq(lessonMedia.lessonId, lessonId), eq(lessonMedia.active, true))).orderBy(asc(lessonMedia.orderIndex), asc(lessonMedia.id));
  const catalog: MediaCatalog = { ...EMPTY_MEDIA, images: {}, audio: [] };
  let revision = 0;
  for (const row of rows) {
    revision = Math.max(revision, row.updatedAt.getTime());
    if (row.kind === "image" && row.slot && isImageSlot(row.slot)) {
      catalog.images[row.slot] = { id: row.id, slot: row.slot, src: mediaUrl(row), title: row.title, alt: row.alt, updatedAt: row.updatedAt.toISOString() };
    } else if (row.kind === "audio" && row.slideKey) {
      catalog.audio.push({ id: row.id, slideKey: row.slideKey, src: mediaUrl(row), title: row.title, mimeType: row.mimeType, updatedAt: row.updatedAt.toISOString() });
    }
  }
  catalog.revision = String(revision);
  return catalog;
}

export async function saveMedia(teacherId: number, input: MediaSaveInput) {
  const lessonId = await ensureSeeded();
  const f = input.fields;
  let sizeBytes = 0;
  let dataBase64: string | null = null;
  let url: string | null = null;
  if (f.source === "uploaded") {
    sizeBytes = validateUpload(input.kind, f.mimeType, f.dataBase64);
    dataBase64 = f.dataBase64;
  } else {
    if (!(f.mimeType.startsWith(`${input.kind}/`) || (input.kind === "audio" && f.mimeType === "audio/ogg"))) {
      throw new Error("نوع الرابط لا يطابق الوسائط المطلوبة");
    }
    url = validateUrl(f.url);
  }
  const values = {
    lessonId,
    teacherId,
    kind: input.kind,
    title: f.title,
    alt: f.alt,
    source: f.source,
    mimeType: f.mimeType,
    dataBase64,
    url,
    sizeBytes,
    active: f.active,
    updatedAt: new Date(),
  };
  if (input.kind === "image") {
    const [row] = await db.insert(lessonMedia).values({ ...values, slot: input.slot, slideKey: null })
      .onConflictDoUpdate({ target: [lessonMedia.lessonId, lessonMedia.slot], set: values })
      .returning();
    return managed(row);
  }
  if (f.id) {
    const [row] = await db.update(lessonMedia).set(values).where(and(eq(lessonMedia.id, f.id), eq(lessonMedia.lessonId, lessonId), eq(lessonMedia.kind, "audio"))).returning();
    if (!row) throw new Error("المقطع غير موجود");
    return managed(row);
  }
  const [row] = await db.insert(lessonMedia).values({ ...values, slot: null, slideKey: input.slideKey }).returning();
  return managed(row);
}

export async function changeMedia(teacherId: number, input: z.infer<typeof mediaChangeSchema>) {
  const lessonId = await ensureSeeded();
  const where = and(eq(lessonMedia.id, input.id), eq(lessonMedia.lessonId, lessonId));
  if (input.action === "delete") {
    const [existing] = await db.select({ id: lessonMedia.id, kind: lessonMedia.kind, legacyAudioId: lessonMedia.legacyAudioId }).from(lessonMedia).where(where).limit(1);
    if (!existing) throw new Error("الوسيط غير موجود");
    if (existing.legacyAudioId !== null) {
      // نحتفظ بعلامة الإخفاء حتى لا يعيد البذر ترحيل المقطع القديم بعد إعادة التشغيل.
      await db.update(lessonMedia).set({ active: false, teacherId, updatedAt: new Date() }).where(where);
      return { ...existing, hiddenLegacy: true };
    }
    const [row] = await db.delete(lessonMedia).where(where).returning({ id: lessonMedia.id, kind: lessonMedia.kind });
    return { ...row, hiddenLegacy: false };
  }
  const patch = input.action === "toggle"
    ? { active: input.active }
    : { title: input.title, slideKey: input.slideKey, active: input.active };
  const condition = input.action === "updateAudio" ? and(where, eq(lessonMedia.kind, "audio")) : where;
  const [row] = await db.update(lessonMedia).set({ ...patch, teacherId, updatedAt: new Date() }).where(condition).returning({ id: lessonMedia.id, kind: lessonMedia.kind });
  if (!row) throw new Error("الوسيط غير موجود");
  return { ...row, hiddenLegacy: false };
}
