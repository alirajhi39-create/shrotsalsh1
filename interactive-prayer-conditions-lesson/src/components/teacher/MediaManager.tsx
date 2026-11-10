"use client";

import { useEffect, useRef, useState } from "react";
import { AUDIO_SLOTS, IMAGE_SLOTS } from "@/lib/media-catalog";
import { EMBEDDED_IMAGES } from "@/lib/embedded-images";
import { Btn, cx } from "@/components/lesson/ui";

type MediaMap = Record<string, { kind: string; dataUrl: string; mime: string; altText: string; title: string; updatedAt: string }>;

async function toDataUrl(file: File, maxImagePx = 640): Promise<{ dataUrl: string; mime: string }> {
  if (file.type.startsWith("image/")) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxImagePx / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
    const out = canvas.toDataURL("image/webp", 0.82);
    if (out.length > 20) return { dataUrl: out, mime: "image/webp" };
  }
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return { dataUrl: `data:${file.type || "application/octet-stream"};base64,${btoa(bin)}`, mime: file.type || "application/octet-stream" };
}

export default function MediaManager({ act, onSaved }: { act: (action: string, payload: Record<string, unknown>) => Promise<boolean>; onSaved?: () => void }) {
  const [media, setMedia] = useState<MediaMap>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"image" | "audio">("image");
  const audioRef = useRef<Record<string, HTMLInputElement | null>>({});

  const load = () => {
    fetch("/api/media", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { media: MediaMap }) => setMedia(d.media ?? {}))
      .catch(() => {});
  };
  useEffect(load, []);

  const saveImage = async (slot: string, label: string) => {
    const input = audioRef.current[slot];
    const file = input?.files?.[0];
    if (!file) return;
    setBusy(slot);
    try {
      const { dataUrl, mime } = await toDataUrl(file);
      const ok = await act("saveMedia", { slot, kind: "image", mime, dataUrl, title: label, altText: label });
      if (ok) {
        if (input) input.value = "";
        load();
        onSaved?.();
      }
    } finally {
      setBusy(null);
    }
  };

  const saveAudio = async (slot: string, label: string) => {
    const input = audioRef.current[slot];
    const file = input?.files?.[0];
    if (!file) return;
    setBusy(slot);
    try {
      const { dataUrl, mime } = await toDataUrl(file);
      const ok = await act("saveMedia", { slot, kind: "audio", mime, dataUrl, title: label, altText: label });
      if (ok) {
        if (input) input.value = "";
        load();
        onSaved?.();
      }
    } finally {
      setBusy(null);
    }
  };

  const recordAudio = async (slot: string, label: string) => {
    setBusy(slot);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.start();
      await new Promise<void>((resolve) => {
        const p = document.createElement("div");
        p.className = "fixed inset-x-0 top-24 z-[80] mx-auto w-fit rounded-2xl bg-rose-600 px-6 py-3 font-black text-white shadow-xl";
        p.textContent = "🔴 جارٍ التسجيل من الميكروفون… اضغط «إيقاف التسجيل» عند الانتهاء";
        const stop = document.createElement("button");
        stop.className = "ms-4 rounded-xl bg-white px-3 py-1 text-sm text-rose-700";
        stop.textContent = "إيقاف التسجيل";
        p.appendChild(stop);
        document.body.appendChild(p);
        stop.onclick = () => {
          mr.stop();
          p.remove();
          resolve();
        };
      });
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
      const { dataUrl, mime } = await toDataUrl(new File([blob], "rec.webm", { type: blob.type }));
      const ok = await act("saveMedia", { slot, kind: "audio", mime, dataUrl, title: label, altText: label });
      if (ok) {
        load();
        onSaved?.();
      }
    } catch {
      alert("تعذر الوصول إلى الميكروفون. تأكد من السماح باستخدامه.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Btn variant={tab === "image" ? "primary" : "secondary"} size="sm" onClick={() => setTab("image")}>🖼️ تعديل الصور</Btn>
        <Btn variant={tab === "audio" ? "primary" : "secondary"} size="sm" onClick={() => setTab("audio")}>🎙️ المقاطع الصوتية</Btn>
      </div>

      {tab === "image" && (
        <div className="grid gap-3 md:grid-cols-2">
          {IMAGE_SLOTS.map((s) => {
            const current = media[s.key]?.kind === "image" ? media[s.key].dataUrl : null;
            const def = EMBEDDED_IMAGES[`/images/${s.key}.webp`];
            return (
              <div key={s.key} className="rounded-2xl border-2 border-slate-200 p-3">
                <p className="text-sm font-bold text-slate-800">{s.label}</p>
                <div className="mt-2 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={current ?? def} alt={s.label} className="h-24 w-20 rounded-xl bg-turq-50 object-contain" />
                  <div className="flex-1 space-y-2">
                    <input
                      ref={(el) => { audioRef.current[s.key] = el; }}
                      type="file"
                      accept="image/*"
                      className="w-full rounded-xl border-2 border-slate-200 p-1 text-xs"
                      disabled={busy === s.key}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => saveImage(s.key, s.label)}
                        disabled={busy === s.key}
                        className="rounded-xl bg-turq-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {busy === s.key ? "جارٍ الحفظ…" : "💾 حفظ الصورة"}
                      </button>
                      {current && (
                        <button
                          onClick={async () => { if (confirm("استعادة الصورة الافتراضية؟")) { if (await act("resetMedia", { slot: s.key })) { load(); onSaved?.(); } } }}
                          className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                        >
                          ↩️ استعادة الافتراضية
                        </button>
                      )}
                    </div>
                    <p className={cx("text-[11px] font-bold", current ? "text-emerald-700" : "text-slate-400")}>
                      {current ? "✅ صورة مخصّصة تظهر لجميع الطلاب" : "الصورة الافتراضية المضمنة"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "audio" && (
        <div className="space-y-2">
          <p className="rounded-2xl bg-sky-50 p-3 text-sm font-bold text-sky-900">
            يمكن رفع ملف صوتي (حتى 3 ميغابايت) أو التسجيل مباشرة من الميكروفون. يظهر المقطع لجميع الطلاب في المحطة المرتبطة، ومع بيانات محدودة يعمل زر «استمع إلى الشرح» بالنطق الآلي.
          </p>
          {AUDIO_SLOTS.map((s) => (
            <div key={s.key} className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-slate-200 p-3">
              <p className="w-full text-sm font-bold text-slate-800 md:w-auto md:flex-1">{s.label}</p>
              <input
                ref={(el) => { audioRef.current[s.key] = el; }}
                type="file"
                accept="audio/*"
                className="rounded-xl border-2 border-slate-200 p-1 text-xs"
                disabled={busy === s.key}
              />
              <button onClick={() => saveAudio(s.key, s.label)} disabled={busy === s.key} className="rounded-xl bg-turq-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-50">
                {busy === s.key ? "…" : "💾 رفع"}
              </button>
              <button onClick={() => recordAudio(s.key, s.label)} disabled={busy === s.key} className="rounded-xl bg-brand-orange px-3 py-1 text-xs font-bold text-white disabled:opacity-50">
                🎤 تسجيل
              </button>
              {media[s.key]?.kind === "audio" && (
                <>
                  <audio controls preload="none" src={media[s.key].dataUrl} className="h-8 w-52" />
                  <button
                    onClick={async () => { if (confirm("حذف هذا المقطع الصوتي؟")) { if (await act("resetMedia", { slot: s.key })) { load(); onSaved?.(); } } }}
                    className="rounded-xl bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700"
                  >
                    حذف
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
