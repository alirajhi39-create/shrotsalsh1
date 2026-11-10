"use client";

import type { LiveLeader } from "@/lib/live-quiz";
import { cx } from "./ui";

const STYLES = [
  { medal: "🥇", title: "المركز الأول", bar: "h-36", card: "from-amber-300 to-yellow-500 text-amber-950", ring: "ring-amber-300" },
  { medal: "🥈", title: "المركز الثاني", bar: "h-28", card: "from-slate-200 to-slate-400 text-slate-900", ring: "ring-slate-300" },
  { medal: "🥉", title: "المركز الثالث", bar: "h-24", card: "from-orange-300 to-amber-600 text-orange-950", ring: "ring-orange-300" },
];

export default function Podium({ leaders, currentPlayerId }: { leaders: LiveLeader[]; currentPlayerId?: number }) {
  const top = leaders.filter((leader) => leader.active).slice(0, 3);
  if (!top.length) return null;
  const visual = [top[1], top[0], top[2]].filter(Boolean) as LiveLeader[];
  return <section className="rounded-3xl bg-gradient-to-b from-sky-50 to-white p-5 shadow" aria-label="المراكز الثلاثة الأولى">
    <h3 className="mb-5 text-center text-2xl font-black text-turq-900">🏆 أبطال المسابقة</h3>
    <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">{visual.map((leader) => { const style = STYLES[leader.rank - 1]; if (!style) return null; return <div key={leader.id} className={cx("flex min-w-0 flex-col items-center", leader.id === currentPlayerId && "rounded-2xl ring-4 ring-offset-2", leader.id === currentPlayerId && style.ring)}><div className={cx("mb-2 w-full rounded-2xl bg-gradient-to-b p-2 text-center shadow-lg sm:p-3", style.card)}><div className="text-3xl sm:text-5xl">{style.medal}</div><p className="truncate text-sm font-black sm:text-lg" title={leader.name}>{leader.name}</p><p className="text-xs font-bold opacity-80">{style.title}</p></div><div className={cx("flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b pt-2 text-xl font-black shadow-inner sm:text-2xl", style.bar, style.card)}>{leader.score}<span className="ms-1 text-xs">نقطة</span></div></div>; })}</div>
  </section>;
}
