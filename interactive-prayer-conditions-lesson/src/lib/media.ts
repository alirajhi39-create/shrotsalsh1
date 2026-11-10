import type { SceneVariant } from "@/components/lesson/SceneArt";

export const IMAGE_SLOTS = [
  { key: "home_hero", label: "صورة الصفحة الرئيسية", description: "تظهر بجانب عنوان الدرس وعند تسجيل الطالب.", defaultSrc: "/images/hero-boy.webp", scene: null },
  { key: "intro_hero", label: "شخصية التهيئة", description: "المحطة الأولى: هل صلاتي صحيحة؟", defaultSrc: "/images/hero-boy.webp", scene: null },
  { key: "intro_adhan", label: "موقف سماع الأذان", description: "المشهد الأول في التهيئة المشوقة.", defaultSrc: null, scene: "adhan" },
  { key: "intro_stain", label: "موقف الثوب المتنجس", description: "المشهد الثاني في التهيئة المشوقة.", defaultSrc: null, scene: "stain" },
  { key: "intro_short", label: "موقف اللباس القصير", description: "المشهد الثالث في التهيئة المشوقة.", defaultSrc: null, scene: "short" },
  { key: "tahara_wudu", label: "مشهد الطهارة والوضوء", description: "يظهر في المحطة الرابعة قبل الفيديو أو عند غيابه.", defaultSrc: null, scene: "wudu" },
  { key: "najasa_body", label: "إزالة النجاسة: البدن", description: "البطاقة التوضيحية في المحطة الخامسة.", defaultSrc: null, scene: "body" },
  { key: "najasa_clothes", label: "إزالة النجاسة: الملابس", description: "البطاقة التوضيحية في المحطة الخامسة.", defaultSrc: null, scene: "clothes" },
  { key: "najasa_place", label: "إزالة النجاسة: مكان الصلاة", description: "البطاقة التوضيحية في المحطة الخامسة.", defaultSrc: null, scene: "place" },
  { key: "detective_hero", label: "شخصية المحقق الصغير", description: "المحطة السادسة: تحدي اكتشاف الخطأ.", defaultSrc: "/images/detective-kid.webp", scene: null },
  { key: "awrah_man", label: "لباس الرجل في الصلاة", description: "المحطة السابعة: توضيح محتشم لستر العورة.", defaultSrc: "/images/man-prayer.webp", scene: null },
  { key: "awrah_woman", label: "لباس المرأة في الصلاة", description: "المحطة السابعة: توضيح محتشم لستر العورة.", defaultSrc: "/images/woman-prayer.webp", scene: null },
  { key: "champion_badge", label: "وسام البطل والشهادة", description: "يظهر في التحدي النهائي وفي شهادة الإنجاز.", defaultSrc: "/images/champion-badge.webp", scene: null },
] as const;

export type ImageSlot = (typeof IMAGE_SLOTS)[number]["key"];
export type MediaKind = "image" | "audio";
export type MediaSource = "uploaded" | "url";
export type PublishedImage = { id: number; slot: ImageSlot; src: string; title: string; alt: string; updatedAt: string };
export type PublishedAudio = { id: number; slideKey: string; src: string; title: string; mimeType: string; updatedAt: string };
export type MediaCatalog = { images: Partial<Record<ImageSlot, PublishedImage>>; audio: PublishedAudio[]; revision: string };
export const EMPTY_MEDIA: MediaCatalog = { images: {}, audio: [], revision: "0" };

export type ManagedMedia = {
  id: number;
  kind: MediaKind;
  slot: ImageSlot | null;
  slideKey: string | null;
  title: string;
  alt: string;
  source: MediaSource;
  mimeType: string;
  src: string;
  sizeBytes: number;
  active: boolean;
  legacyAudioId: number | null;
  updatedAt: string;
};

export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const AUDIO_MIME_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/webm"] as const;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
export const IMAGE_SLOT_KEYS = IMAGE_SLOTS.map((slot) => slot.key);
export const STATION_KEYS = ["intro", "discover", "three", "tahara", "najasa", "detective", "awrah", "ayah", "classify", "book", "quiz", "champion"] as const;

export function isImageSlot(value: string): value is ImageSlot {
  return IMAGE_SLOT_KEYS.includes(value as ImageSlot);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "رابط خارجي";
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} ك.ب` : `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
}

export function sceneSlot(variant: SceneVariant): ImageSlot {
  if (variant === "wudu") return "tahara_wudu";
  if (variant === "body" || variant === "clothes" || variant === "place") return `najasa_${variant}`;
  return `intro_${variant}`;
}

// النوع فقط: لا تُستدعى مكونات العميل على الخادم.
export type { SceneVariant };
