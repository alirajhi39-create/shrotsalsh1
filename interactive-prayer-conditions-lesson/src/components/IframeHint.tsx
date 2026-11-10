"use client";

import { useEffect, useState } from "react";

/** يظهر فقط عندما يكون الموقع معروضًا داخل إطار (iframe) ويقترح فتحه في تبويب مستقل. */
export default function IframeHint({ compact = false }: { compact?: boolean }) {
  const [framed, setFramed] = useState(false);
  useEffect(() => {
    try {
      setFramed(window.self !== window.top);
    } catch {
      setFramed(true);
    }
  }, []);
  if (!framed) return null;
  const href = typeof window !== "undefined" ? window.location.href : "#";
  return (
    <div className={`no-print mb-4 flex flex-wrap items-center gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50 p-3 text-amber-900 ${compact ? "text-xs" : "text-sm"} font-bold`}>
      <span>⚠️ الموقع معروض داخل نافذة معاينة؛ إذا لم يعمل الدخول أو لم تُحفظ الجلسة، افتحه في تبويب مستقل.</span>
      <a href={href} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-amber-500 px-3 py-1 text-white shadow hover:bg-amber-600">
        فتح في تبويب جديد ↗
      </a>
    </div>
  );
}
