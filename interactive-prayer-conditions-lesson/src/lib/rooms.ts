import { CLASSIFY_CARDS, NAJASA_CARDS } from "./content";

/**
 * غرف المسابقة الجماعية تُخزَّن على كائن العملية العام حتى يتشاركها
 * مسار المعلم ومسار الطالب في نفس النسخة (وتُنظَّف تلقائيًا بعد ساعتين).
 */
export type Player = { id: string; name: string; score: number; answered: boolean; choice: string | null; at: number };
export type RoomMode = "conditions" | "najasa";
export type Room = {
  code: string;
  teacherId: number;
  mode: RoomMode;
  index: number;
  order: { id: string; label: string; zone: string }[];
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
    for (const [code, r] of rooms) if (now - r.createdAt > 2 * 3600 * 1000) rooms.delete(code);
  }, 15 * 60 * 1000);
  (store.__shurutRoomsCleaner as unknown as { unref?: () => void }).unref?.();
}

export function buildDeck(mode: RoomMode) {
  return mode === "conditions"
    ? CLASSIFY_CARDS.map((c) => ({ id: c.id, label: c.label, zone: c.zone }))
    : NAJASA_CARDS.map((c) => ({ id: c.id, label: `${c.emoji} ${c.label}`, zone: c.zone }));
}

export function shuffledDeck(mode: RoomMode) {
  const d = buildDeck(mode);
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export function zonesFor(mode: RoomMode) {
  return mode === "conditions"
    ? [
        { id: "islam", label: "الإسلام", emoji: "🕌" },
        { id: "tamyeez", label: "التمييز", emoji: "🧒" },
        { id: "aql", label: "العقل", emoji: "🧠" },
        { id: "tahara", label: "الطهارة", emoji: "💧" },
        { id: "najasa", label: "إزالة النجاسة", emoji: "🧼" },
        { id: "awrah", label: "ستر العورة", emoji: "👕" },
      ]
    : [
        { id: "body", label: "البدن", emoji: "🙋" },
        { id: "clothes", label: "الملابس", emoji: "👕" },
        { id: "place", label: "مكان الصلاة", emoji: "🧎" },
      ];
}

export const POINTS_PER_CORRECT = 10;

declare global {
  // eslint-disable-next-line no-var
  var __shurutRoomsCleaner: ReturnType<typeof setInterval> | undefined;
}
