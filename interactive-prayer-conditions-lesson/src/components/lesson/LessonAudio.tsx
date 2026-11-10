"use client";

import { useState } from "react";
import { useLessonMedia } from "./LessonMediaProvider";

function Clip({ src, title }: { src: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <p className="mb-2 flex items-center gap-2 font-bold text-turq-900"><span aria-hidden>🎧</span>{title}</p>
      <audio key={`${src}-${attempt}`} controls preload="metadata" src={src} className="w-full" aria-label={title}
        onPlay={(event) => { document.querySelectorAll("audio").forEach((audio) => { if (audio !== event.currentTarget) audio.pause(); }); }}
        onError={() => setFailed(true)} onCanPlay={() => setFailed(false)} />
      {failed && <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-rose-700"><span>تعذر تشغيل المقطع. تحقق من الاتصال أو الرابط.</span><button className="font-bold underline" onClick={() => { setFailed(false); setAttempt((v) => v + 1); }}>إعادة المحاولة</button></div>}
    </div>
  );
}

export function LessonAudioList({ slideKey }: { slideKey: string }) {
  const { catalog } = useLessonMedia();
  const clips = catalog.audio.filter((clip) => clip.slideKey === slideKey);
  if (!clips.length) return null;
  return (
    <section className="mb-5 rounded-3xl border-2 border-turq-200 bg-turq-50 p-4" aria-label="مقاطع المعلم الصوتية">
      <h3 className="mb-3 text-lg font-black text-turq-900">🎧 استمع إلى شرح المعلم</h3>
      <div className="grid gap-3">{clips.map((clip) => <Clip key={`${clip.id}-${clip.updatedAt}`} src={clip.src} title={clip.title} />)}</div>
    </section>
  );
}
