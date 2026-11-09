"use client";

import { useEffect, useState } from "react";
import { EMBEDDED_IMAGES } from "@/lib/embedded-images";
import { cx } from "./ui";

/**
 * صورة موثوقة في كل بيئات النشر:
 *  - الصور مُضمّنة كـ Data URI داخل الكود، فلا يوجد أي طلب شبكة لملف صورة،
 *    ولا تتأثر بغياب ملفات public أو باختلاف نسخة النشر على Vercel.
 *  - لا تستخدم مُحسّن next/image، وتُحمّل فورًا (eager) داخل الطبقات القابلة للتمرير.
 *  - إن تعذّر التحميل لأي سبب تُجرّب نسخة PNG من public، ثم يظهر بديل رسومي.
 */
export default function SafeImage({
  src,
  alt,
  className,
  imgClassName,
  fallback = "🖼️",
  rounded = false,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallback?: string;
  rounded?: boolean;
}) {
  const embedded = EMBEDDED_IMAGES[src] ?? null;
  const png = src.endsWith(".webp") ? src.replace(/\.webp$/, ".png") : null;
  const [current, setCurrent] = useState<string>(embedded ?? src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrent(embedded ?? src);
    setFailed(false);
  }, [src, embedded]);

  return (
    <div className={cx("relative overflow-hidden", rounded && "rounded-3xl", className)}>
      {failed ? (
        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-turq-100 to-sky-100 text-6xl" role="img" aria-label={alt}>
          {fallback}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current}
          alt={alt}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          draggable={false}
          onError={() => {
            if (embedded && current === embedded) setCurrent(png ?? src);
            else if (png && current !== png) setCurrent(png);
            else setFailed(true);
          }}
          className={cx("absolute inset-0 h-full w-full object-contain", imgClassName)}
        />
      )}
    </div>
  );
}
