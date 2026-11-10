"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { EMPTY_MEDIA, type MediaCatalog } from "@/lib/media";

type MediaContextValue = {
  catalog: MediaCatalog;
  refresh: () => Promise<void>;
  synced: boolean;
};
const MediaContext = createContext<MediaContextValue>({ catalog: EMPTY_MEDIA, refresh: async () => {}, synced: false });

export default function LessonMediaProvider({ initial, children }: { initial: MediaCatalog; children: ReactNode }) {
  const [catalog, setCatalog] = useState(initial);
  const [synced, setSynced] = useState(false);
  const busy = useRef(false);
  useEffect(() => setCatalog(initial), [initial]);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const response = await fetch("/api/lesson/media", { cache: "no-store" });
      const data = await response.json() as { ok?: boolean; media?: MediaCatalog };
      if (response.ok && data.ok && data.media?.images && Array.isArray(data.media.audio)) {
        setCatalog(data.media);
        setSynced(true);
      }
    } catch {
      // لا نمسح الوسائط السابقة عند انقطاع الشبكة.
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    const updated = () => void refresh();
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", updated);
    window.addEventListener("lesson-media-updated", updated);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", updated);
      window.removeEventListener("lesson-media-updated", updated);
    };
  }, [refresh]);

  return <MediaContext.Provider value={{ catalog, refresh, synced }}>{children}</MediaContext.Provider>;
}

export function useLessonMedia() {
  return useContext(MediaContext);
}
