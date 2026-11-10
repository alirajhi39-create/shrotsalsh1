import { CLASSIFY_CARDS, NAJASA_CARDS } from "./content";

/**
 * غرف المسابقة الجماعية تُخزَّن على كائن العملية العام حتى يتشاركها
 * مسار المعلم ومسار الطالب في نفس النسخة (وتُنظَّف تلقائيًا بعد 6 ساعات).
 */
export type Player = { id: string; name: string; score: number; answered: boolean; choice: string | null; at: number };
export type RoomMode = "conditions" | "najasa";
export type QuizCard = { id: string; label: string; zone: string; kind?: "classify" | "mcq"; options?: { id: string; label: string; emoji?: string }[] };
export type Room = {
  code: string;
  teacherId: number;
  mode: RoomMode;
  index: number;
  order: QuizCard[];
  players: Map<string, Player>;
  reveal: boolean;
  createdAt: number;
  questionAt: number;
  finished: boolean;
};

const store = globalThis as typeof globalThis & { __shurutRooms?: Map<string, Room> };

export const rooms: Map<string, Room> = (store.__shurutRooms ??= new Map());

if (!store.__shurutRoomsCleaner) {
  store.__shurutRoomsCleaner = setInterval(() => {
    const now = Date.now();
    for (const [code, r] of rooms) if (now - r.createdAt > 6 * 3600 * 1000) rooms.delete(code);
  }, 30 * 60 * 1000);
  (store.__shurutRoomsCleaner as unknown as { unref?: () => void }).unref?.();
}

export const POINTS_PER_CORRECT = 10;

export const ZONE_LABELS: Record<string, string> = {
  islam: "الإسلام",
  tamyeez: "التمييز",
  aql: "العقل",
  tahara: "الطهارة",
  najasa: "إزالة النجاسة",
  awrah: "ستر العورة",
  body: "البدن",
  clothes: "الملابس",
  place: "مكان الصلاة",
};

export function zonesFor(mode: RoomMode) {
  return mode === "conditions"
    ? ["islam", "tamyeez", "aql", "tahara", "najasa", "awrah"].map((id) => ({ id, label: ZONE_LABELS[id], emoji: zoneEmoji(id) }))
    : ["body", "clothes", "place"].map((id) => ({ id, label: ZONE_LABELS[id], emoji: zoneEmoji(id) }));
}

export function zoneEmoji(id: string) {
  return ({ islam: "🕌", tamyeez: "🧒", aql: "🧠", tahara: "💧", najasa: "🧼", awrah: "👕", body: "🙋", clothes: "👕", place: "🧎" })[id] ?? "📌";
}

/** البطاقات الافتراضية من محتوى الكتاب المدرسي */
export function buildDeck(mode: RoomMode): QuizCard[] {
  return mode === "conditions"
    ? CLASSIFY_CARDS.map((c) => ({ id: c.id, label: c.label, zone: c.zone }))
    : NAJASA_CARDS.map((c) => ({ id: c.id, label: `${c.emoji} ${c.label}`, zone: c.zone }));
}

export function shuffledDeck(mode: RoomMode): QuizCard[] {
  const d = buildDeck(mode);
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

declare global {
  // eslint-disable-next-line no-var
  var __shurutRoomsCleaner: ReturnType<typeof setInterval> | undefined;
}
