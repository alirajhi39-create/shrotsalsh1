"use client";

import { useEffect, useState } from "react";
import SafeImage from "@/components/lesson/SafeImage";
import { useMedia, resolveImage } from "@/components/lesson/media";

/**
 * صورة تتبع تعديلات المعلم على جميع الأجهزة.
 * القيمة الأولية (initialSrc) تُقرأ من الخادم، ثم تُحدَّث لحظيًا من /api/media
 * حتى تظهر التعديلات دون إعادة تحميل الصفحة.
 */
export default function MediaImage({
  slot,
  path,
  alt,
  initialSrc,
  initialAlt,
  className,
  imgClassName,
  fallback,
  rounded,
}: {
  slot: string;
  path: string;
  alt: string;
  initialSrc?: string;
  initialAlt?: string;
  className?: string;
  imgClassName?: string;
  fallback?: string;
  rounded?: boolean;
}) {
  const media = useMedia([slot]);
  const live = media[slot]?.kind === "image" ? media[slot].dataUrl : null;
  const [src, setSrc] = useState<string>(initialSrc ?? resolveImage({}, slot, path));
  const [altText, setAltText] = useState<string>(initialAlt ?? alt);

  useEffect(() => {
    const next = live ?? initialSrc ?? resolveImage({}, slot, path);
    setSrc(next);
    setAltText(media[slot]?.altText || initialAlt || alt);
  }, [live, initialSrc, initialAlt, slot, path, alt, media]);

  return (
    <SafeImage
      key={src}
      src={src}
      alt={altText}
      className={className}
      imgClassName={imgClassName}
      fallback={fallback}
      rounded={rounded}
    />
  );
}
