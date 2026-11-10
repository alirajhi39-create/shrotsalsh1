"use client";

export type SceneVariant = "adhan" | "stain" | "short" | "wudu" | "body" | "clothes" | "place";

const LABELS: Record<SceneVariant, string> = {
  adhan: "طالب يسمع الأذان ويستعد للصلاة",
  stain: "بقعة على ثوب الصلاة",
  short: "سروال قصير فوق الركبة",
  wudu: "الوضوء والطهارة قبل الصلاة",
  body: "البدن",
  clothes: "الملابس",
  place: "مكان الصلاة",
};

/**
 * رسوم تعليمية متجهية (SVG) مدمجة في الكود — لا تحتاج ملفات ولا مُحسّن صور،
 * فتظهر دائمًا حتى لو تعذّر تحميل ملفات public أو في بيئة نشر مختلفة.
 */
export default function SceneArt({ variant, className = "h-28 w-full" }: { variant: SceneVariant; className?: string }) {
  const bg = (
    <>
      <defs>
        <linearGradient id={`sg-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d4f7f4" />
          <stop offset="100%" stopColor="#e8f2ff" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="196" height="116" rx="16" fill={`url(#sg-${variant})`} stroke="#aceeea" strokeWidth="2" />
      <circle cx="24" cy="24" r="10" fill="#ffffff" opacity=".55" />
      <circle cx="178" cy="96" r="14" fill="#ffffff" opacity=".45" />
    </>
  );

  const figure = (
    <g>
      {/* الرأس والغطاء */}
      <circle cx="100" cy="40" r="14" fill="#f4cba9" />
      <path d="M86 38a14 14 0 0 1 28 0v-4a14 14 0 0 0-28 0z" fill="#ffffff" />
      <path d="M85 36q15-18 30 0z" fill="#ffffff" />
      {/* الوجه */}
      <circle cx="95" cy="41" r="1.7" fill="#2c4a4a" />
      <circle cx="105" cy="41" r="1.7" fill="#2c4a4a" />
      <path d="M96 47q4 3 8 0" stroke="#2c4a4a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* الثوب */}
      <path d="M84 55h32l10 53H74z" fill="#ffffff" stroke="#bfe6e4" strokeWidth="2" />
      <path d="M84 55l-14 33 9 4 12-27M116 55l14 33-9 4-12-27" fill="#ffffff" stroke="#bfe6e4" strokeWidth="2" strokeLinejoin="round" />
    </g>
  );

  let content: React.ReactNode = figure;

  switch (variant) {
    case "adhan":
      content = (
        <>
          {/* مئذنة وأذان */}
          <g>
            <rect x="18" y="42" width="14" height="62" fill="#1fadab" rx="2" />
            <path d="M16 42l9-18 9 18z" fill="#178b8b" />
            <rect x="21" y="30" width="8" height="10" fill="#ffffff" opacity=".7" />
            <path d="M38 30q10 10 0 20M46 24q18 16 0 32" stroke="#f7931e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <circle cx="168" cy="26" r="12" fill="#ffe6a8" />
          </g>
          {figure}
          <text x="100" y="114" textAnchor="middle" fontSize="9" fill="#176f70" fontWeight="700">
            حان وقت الصلاة
          </text>
        </>
      );
      break;
    case "stain":
      content = (
        <>
          {figure}
          <circle cx="108" cy="82" r="7" fill="#f97316" opacity=".85" />
          <circle cx="108" cy="82" r="12" fill="none" stroke="#f7931e" strokeWidth="2" strokeDasharray="3 3" />
          <g>
            <circle cx="158" cy="60" r="13" fill="#ffffff" opacity=".8" stroke="#1e6fd9" strokeWidth="3" />
            <path d="M167 69l10 10" stroke="#1e6fd9" strokeWidth="4" strokeLinecap="round" />
          </g>
        </>
      );
      break;
    case "short":
      content = (
        <>
          {/* الرأس */}
          <circle cx="100" cy="38" r="14" fill="#f4cba9" />
          <path d="M85 34q15-16 30 0z" fill="#ffffff" />
          <circle cx="95" cy="39" r="1.7" fill="#2c4a4a" />
          <circle cx="105" cy="39" r="1.7" fill="#2c4a4a" />
          <path d="M96 45q4 3 8 0" stroke="#2c4a4a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          {/* قميص قصير وساقان (تمثيل تعليمي محتشم) */}
          <path d="M84 53h32v26H84z" fill="#38bdf8" stroke="#0284c7" strokeWidth="2" />
          <rect x="84" y="79" width="14" height="25" rx="4" fill="#f4cba9" />
          <rect x="102" y="79" width="14" height="25" rx="4" fill="#f4cba9" />
          <path d="M88 53l-12 24 8 4 10-20M112 53l12 24-8 4-10-20" fill="#38bdf8" stroke="#0284c7" strokeWidth="2" />
          <path d="M72 81h56" stroke="#f7931e" strokeWidth="2" strokeDasharray="4 3" />
        </>
      );
      break;
    case "wudu":
      content = (
        <>
          {/* صنبور وماء */}
          <path d="M28 30h30v10H48v8" stroke="#1e6fd9" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="42" y="38" width="10" height="8" rx="2" fill="#f7931e" />
          <path d="M48 48v14" stroke="#3bc8c5" strokeWidth="5" strokeLinecap="round" />
          <circle cx="48" cy="68" r="4" fill="#3bc8c5" />
          <circle cx="40" cy="78" r="3" fill="#74dfdb" />
          <circle cx="56" cy="80" r="3" fill="#74dfdb" />
          {figure}
          {/* يدان تحت الماء */}
          <ellipse cx="78" cy="86" rx="10" ry="5" fill="#f4cba9" />
          <ellipse cx="96" cy="90" rx="10" ry="5" fill="#f4cba9" />
          <text x="130" y="112" textAnchor="middle" fontSize="9" fill="#176f70" fontWeight="700">
            أتوضأ قبل الصلاة
          </text>
        </>
      );
      break;
    case "body":
      content = (
        <>
          <circle cx="100" cy="36" r="14" fill="#f4cba9" />
          <path d="M84 54h32l8 54H76z" fill="#ffffff" stroke="#bfe6e4" strokeWidth="2" />
          <ellipse cx="70" cy="78" rx="9" ry="12" fill="#f4cba9" />
          <circle cx="70" cy="72" r="6" fill="#3bc8c5" opacity=".65" />
          <path d="M60 60l-6-8M80 60l6-8" stroke="#74dfdb" strokeWidth="3" strokeLinecap="round" />
        </>
      );
      break;
    case "clothes":
      content = (
        <>
          <path d="M78 26l22-8 22 8 18 14-14 16-10-8v62H84V48l-10 8-14-16z" fill="#ffffff" stroke="#1fadab" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="100" cy="70" r="7" fill="#f97316" opacity=".7" />
          <circle cx="142" cy="34" r="10" fill="#e0f7ff" stroke="#3bc8c5" strokeWidth="2" />
          <circle cx="152" cy="22" r="5" fill="#e0f7ff" stroke="#3bc8c5" strokeWidth="2" />
        </>
      );
      break;
    case "place":
      content = (
        <>
          <rect x="40" y="44" width="120" height="60" rx="8" fill="#22a06b" opacity=".85" />
          <rect x="48" y="52" width="104" height="44" rx="5" fill="none" stroke="#ffffff" strokeWidth="2" opacity=".8" />
          <path d="M100 58l14 20H86z" fill="#ffffff" opacity=".7" />
          <circle cx="100" cy="92" r="5" fill="#ffffff" opacity=".7" />
          <path d="M30 36l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" fill="#f7931e" />
        </>
      );
      break;
  }

  return (
    <svg viewBox="0 0 200 120" className={className} role="img" aria-label={LABELS[variant]} preserveAspectRatio="xMidYMid meet">
      {bg}
      {content}
    </svg>
  );
}
