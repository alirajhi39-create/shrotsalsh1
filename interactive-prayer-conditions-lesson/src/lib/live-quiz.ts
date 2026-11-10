export type LiveMode = "mixed" | "assessment" | "conditions" | "najasa";
export const LIVE_MODE_LABELS: Record<LiveMode, string> = {
  mixed: "المسابقة الشاملة: أسئلة الدرس والتقويم والمواقف",
  assessment: "أسئلة التقويم الختامي فقط",
  conditions: "تصنيف المواقف تحت الشروط الستة",
  najasa: "مواضع إزالة النجاسة",
};
export type LiveStatus = "lobby" | "active" | "reveal" | "ended";
export type LiveOption = { id: string; label: string; emoji?: string };
export type LiveQuestion = { prompt: string; options: LiveOption[]; correctOptionId?: string; explanation?: string };
export type LiveLeader = { id: number; name: string; score: number; correct: number; answered: number; rank: number; active: boolean };
export type LiveHostState = {
  code: string; mode: LiveMode; status: LiveStatus; currentRound: number; totalRounds: number;
  questionSeconds: number; timeLeft: number; question: LiveQuestion | null;
  players: LiveLeader[]; playerCount: number; answeredCount: number; optionCounts: Record<string, number>;
  joinPath: string; expiresAt: string;
};
export type LivePlayerState = {
  code: string; mode: LiveMode; status: LiveStatus; currentRound: number; totalRounds: number;
  timeLeft: number; question: LiveQuestion | null; player: { id: number; name: string; score: number; rank: number };
  ownAnswer: { optionId: string; isCorrect: boolean; points: number } | null;
  leaderboard: LiveLeader[]; expiresAt: string;
};
