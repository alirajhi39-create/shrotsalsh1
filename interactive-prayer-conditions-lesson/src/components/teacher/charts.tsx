/** مخططات SVG بسيطة بلا مكتبات خارجية – تعمل في مكونات الخادم */

export function BarChart({
  data,
  suffix = "%",
  max = 100,
  height = 28,
}: {
  data: { label: string; value: number; color?: string }[];
  suffix?: string;
  max?: number;
  height?: number;
}) {
  if (!data.length) return <p className="text-sm text-slate-500">لا توجد بيانات بعد.</p>;
  return (
    <div className="space-y-2">
      {data.map((d) => {
        const pct = max ? Math.min(100, Math.max(0, (d.value / max) * 100)) : 0;
        return (
          <div key={d.label} className="grid grid-cols-[140px_1fr_56px] items-center gap-2 text-sm">
            <span className="truncate font-bold text-slate-700" title={d.label}>
              {d.label}
            </span>
            <svg width="100%" height={height} role="img" aria-label={`${d.label}: ${d.value}${suffix}`}>
              <rect x="0" y="0" width="100%" height={height} rx={height / 2} fill="#e8f6f6" />
              <rect x="0" y="0" width={`${pct}%`} height={height} rx={height / 2} fill={d.color ?? "#1fadab"} />
            </svg>
            <span className="text-end font-black text-turq-900">
              {Math.round(d.value)}
              {suffix}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ColumnChart({ data, max = 100, suffix = "%" }: { data: { label: string; value: number; color?: string }[]; max?: number; suffix?: string }) {
  if (!data.length) return <p className="text-sm text-slate-500">لا توجد بيانات بعد.</p>;
  const w = Math.max(320, data.length * 56);
  const h = 180;
  const pad = 24;
  const bw = (w - pad * 2) / data.length;
  return (
    <div className="overflow-x-auto">
      <svg width={w} height={h + 40} role="img" className="mx-auto block">
        {[0, 25, 50, 75, 100].map((g) => {
          const y = pad + (h - pad) * (1 - g / 100);
          return <line key={g} x1={pad} x2={w - pad} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />;
        })}
        {data.map((d, i) => {
          const pct = max ? Math.min(1, Math.max(0, d.value / max)) : 0;
          const bh = (h - pad) * pct;
          const x = pad + i * bw + bw * 0.2;
          const y = h - bh;
          return (
            <g key={d.label}>
              <rect x={x} y={y} width={bw * 0.6} height={bh} rx={6} fill={d.color ?? "#1e6fd9"} />
              <text x={x + bw * 0.3} y={y - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0f2a2a">
                {Math.round(d.value)}
                {suffix}
              </text>
              <text x={x + bw * 0.3} y={h + 18} textAnchor="middle" fontSize="11" fill="#475569">
                {d.label.length > 8 ? d.label.slice(0, 8) + "…" : d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Donut({ percent, label, color = "#22a06b" }: { percent: number; label: string; color?: string }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, percent));
  return (
    <div className="flex items-center gap-3">
      <svg width="110" height="110" viewBox="0 0 110 110" role="img" aria-label={`${label}: ${Math.round(p)}%`}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="#e8f6f6" strokeWidth="12" />
        <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(c * p) / 100} ${c}`} transform="rotate(-90 55 55)" />
        <text x="55" y="60" textAnchor="middle" fontSize="20" fontWeight="900" fill="#0f2a2a">
          {Math.round(p)}%
        </text>
      </svg>
      <span className="font-bold text-slate-700">{label}</span>
    </div>
  );
}

export function StatCard({ title, value, hint, icon, tone = "turq" }: { title: string; value: string | number; hint?: string; icon: string; tone?: "turq" | "orange" | "green" | "rose" | "blue" }) {
  const tones = {
    turq: "from-turq-500 to-turq-700",
    orange: "from-orange-400 to-orange-600",
    green: "from-emerald-400 to-emerald-600",
    rose: "from-rose-400 to-rose-600",
    blue: "from-sky-400 to-blue-600",
  };
  return (
    <div className={`rounded-3xl bg-gradient-to-br ${tones[tone]} p-5 text-white shadow-lg`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold opacity-90">{title}</span>
        <span className="text-3xl">{icon}</span>
      </div>
      <p className="mt-2 text-4xl font-black">{value}</p>
      {hint && <p className="mt-1 text-xs opacity-90">{hint}</p>}
    </div>
  );
}
