"use client";

import { sceneSlot } from "@/lib/media";
import { useLessonMedia } from "./LessonMediaProvider";
import SafeImage from "./SafeImage";
import SceneArt, { type SceneVariant } from "./SceneArt";

export function LessonScene({ variant, className }: { variant: SceneVariant; className?: string }) {
  const { catalog } = useLessonMedia();
  const slot = sceneSlot(variant);
  const custom = catalog.images[slot];
  if (!custom) return <SceneArt variant={variant} className={className} />;
  return <SafeImage slot={slot} src={custom.src} alt={custom.alt || custom.title} className={className} fallback="🖼️" />;
}
