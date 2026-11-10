"use client";

import { useEffect, useState } from "react";
import { EMBEDDED_IMAGES } from "@/lib/embedded-images";
import type { ImageSlot } from "@/lib/media";
import { useLessonMedia } from "./LessonMediaProvider";
import { cx } from "./ui";

/** الصورة المخصصة من قاعدة البيانات، ثم الصورة المدمجة، ثم PNG، ثم بديل رسومي. */
export default function SafeImage({
  src, alt, className, imgClassName, fallback = "🖼️", rounded = false, slot,
}: {
  src: string; alt: string; className?: string; imgClassName?: string; fallback?: string; rounded?: boolean; slot?: ImageSlot;
}) {
  const { catalog } = useLessonMedia();
  const custom = slot ? catalog.images[slot] : undefined;
  const resolved = custom?.src ?? src;
  const embedded = EMBEDDED_IMAGES[src] ?? null;
  const png = src.endsWith(".webp") ? src.replace(/\.webp$/, ".png") : null;
  const [current, setCurrent] = useState<string>(custom ? resolved : embedded ?? src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrent(custom ? resolved : embedded ?? src);
    setFailed(false);
  }, [resolved, custom, embedded, src]);

  return (
    <div className={cx("relative overflow-hidden", rounded && "rounded-3xl", className)}>
      {failed ? (
        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-turq-100 to-sky-100 text-6xl" role="img" aria-label={alt}>{fallback}</div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={current}
          alt={custom?.alt || alt}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          draggable={false}
          onError={() => {
            if (custom && current === custom.src) setCurrent(embedded ?? png ?? src);
            else if (embedded && current === embedded && png) setCurrent(png);
            else if (png && current !== png) setCurrent(png);
            else setFailed(true);
          }}
          className={cx("absolute inset-0 h-full w-full object-contain", imgClassName)}
        />
      )}
    </div>
  );
}
