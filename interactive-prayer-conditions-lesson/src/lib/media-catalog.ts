export type MediaSlot = { key: string; label: string; fallback?: string; stations?: string[] };

export const IMAGE_SLOTS: MediaSlot[] = [
  { key: "hero-boy", label: "صورة الطالب (التهيئة والصفحة الرئيسية)", fallback: "🧒" },
  { key: "detective-kid", label: "صورة المحقق الصغير (المحطة 6)", fallback: "🕵️" },
  { key: "man-prayer", label: "لباس الرجل (المحطة 7)", fallback: "👳" },
  { key: "woman-prayer", label: "لباس المرأة (المحطة 7)", fallback: "🧕" },
  { key: "champion-badge", label: "وسام البطل (المحطة 12 والشهادة)", fallback: "🏆" },
];

export const AUDIO_SLOTS: MediaSlot[] = [
  { key: "intro-voice", label: "تعريف المحطة الأولى (التهيئة)", stations: ["intro"] },
  { key: "tahara-voice", label: "شرح محطة الطهارة", stations: ["tahara"] },
  { key: "najasa-voice", label: "شرح محطة إزالة النجاسة", stations: ["najasa"] },
  { key: "awrah-voice", label: "شرح محطة ستر العورة", stations: ["awrah"] },
  { key: "ayah-recite", label: "تلاوة الآية الكريمة", stations: ["ayah"] },
];

export const MEDIA_BY_KEY = new Map([...IMAGE_SLOTS, ...AUDIO_SLOTS].map((s) => [s.key, s]));
