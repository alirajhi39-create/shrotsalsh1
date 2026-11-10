"use client";

import { useCallback, useEffect, useState } from "react";
import { AUDIO_SLOTS, IMAGE_SLOTS } from "@/lib/media-catalog";
import { EMBEDDED_IMAGES } from "@/lib/embedded-images";

export type MediaItem = { kind: string; dataUrl: string; mime: string; altText: string; title: string; updatedAt: string };
export type MediaMap = Record<string, MediaItem>;

const CACHE_KEY = "shurut_media_v1";

/** يجلب وسائط المعلم ويحفظها محليًا لتظهر فورًا على كل الأجهزة */
export function useMedia(slots?: string[]) {
  const [media, setMedia] = useState<MediaMap>({});

  useEffect(() => {
    // استجابة سريعة من الكاش إن وُجد، ثم التحديث دائمًا من الخادم
    // (نحذف المفاتيح التي لم تعد موجودة على الخادم حتى تظهر التراجعات فورًا)
    let cached: MediaMap = {};
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        cached = JSON.parse(raw) as MediaMap;
        setMedia(cached);
      }
    } catch {
      /* تجاهل */
    }
    const query = slots?.length ? `?slots=${slots.join(",")}` : "";
    fetch(`/api/media${query}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { media: MediaMap }) => {
        const fresh = d.media ?? {};
        const merged: MediaMap = {};
        const keys = new Set([...Object.keys(cached), ...Object.keys(fresh)]);
        for (const k of keys) if (fresh[k]) merged[k] = fresh[k];
        setMedia(merged);
        try {
          if (Object.keys(merged).length) localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
          else localStorage.removeItem(CACHE_KEY);
        } catch {
          /* تجاهل */
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return media;
}

/** مصدر الصورة النهائي: وسم المعلم ← الصورة المضمّنة ← المسار الأصلي */
export function resolveImage(media: MediaMap, slot: string, fallbackPath: string): string {
  const m = media[slot];
  if (m?.kind === "image" && m.dataUrl) return m.dataUrl;
  return EMBEDDED_IMAGES[fallbackPath] ?? fallbackPath;
}

/** مكوّن مشغّل الصوت التعليمي (تسجيل المعلم أو النطق الآلي كبديل) */
export function TeacherAudioPlayer({
  slot,
  fallbackText,
  speak,
  className,
}: {
  slot: string;
  fallbackText: string;
  speak: (text: string) => void;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none">("loading");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/media/audio/${slot}`, { cache: "no-store" });
      if (!res.ok) {
        setState("none");
        return;
      }
      const blob = await res.blob();
      setSrc(URL.createObjectURL(blob));
      setState("ready");
    } catch {
      setState("none");
    }
  }, [slot]);

  useEffect(() => {
    load();
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  return (
    <div className={className}>
      {state === "ready" && src ? (
        <audio controls preload="none" src={src} className="w-full" />
      ) : state === "loading" ? (
        <button
          type="button"
          onClick={load}
          className="touch-target rounded-2xl bg-turq-50 px-4 text-sm font-bold text-turq-700 hover:bg-turq-100"
        >
          🔁 تحميل التسجيل
        </button>
      ) : (
        <button
          type="button"
          onClick={() => speak(fallbackText)}
          className="touch-target rounded-2xl bg-turq-50 px-4 text-sm font-bold text-turq-700 hover:bg-turq-100"
          title="النطق الآلي"
        >
          🔊 استمع إلى الشرح
        </button>
      )}
    </div>
  );
}

export { AUDIO_SLOTS, IMAGE_SLOTS };
