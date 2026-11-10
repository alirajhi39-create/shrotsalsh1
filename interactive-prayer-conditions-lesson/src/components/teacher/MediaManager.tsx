"use client";

import { useState, type FormEvent } from "react";
import { teacherFetch } from "@/lib/client-auth";
import { AUDIO_MIME_TYPES, IMAGE_MIME_TYPES, IMAGE_SLOTS, MAX_AUDIO_BYTES, MAX_IMAGE_BYTES, formatBytes, type ImageSlot, type ManagedMedia } from "@/lib/media";
import { SLIDES } from "@/lib/content";
import { EMBEDDED_IMAGES } from "@/lib/embedded-images";
import SceneArt, { type SceneVariant } from "@/components/lesson/SceneArt";
import { useLessonMedia } from "@/components/lesson/LessonMediaProvider";
import { Btn, cx } from "@/components/lesson/ui";

const field = "w-full rounded-xl border-2 border-slate-200 bg-white p-2.5 text-sm focus:border-turq-500 focus:outline-none";
const panel = "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm";

async function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("تعذر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}
function urlMime(kind: "image" | "audio", url: string) {
  const ext = new URL(url).pathname.toLowerCase().split(".").pop();
  if (kind === "image") return ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : ext === "png" ? "image/png" : "image/jpeg";
  return ext === "wav" ? "audio/wav" : ext === "ogg" ? "audio/ogg" : ext === "m4a" ? "audio/x-m4a" : ext === "webm" ? "audio/webm" : "audio/mpeg";
}

function useSender(onChange: () => Promise<void>) {
  const { refresh } = useLessonMedia();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const send = async (body: Record<string, unknown>) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await teacherFetch("/api/teacher/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { ok?: boolean; msg?: string; error?: string };
      if (!response.ok || !data.ok) { setError(data.error ?? "تعذر الحفظ"); return false; }
      setMessage(data.msg ?? "تم الحفظ لجميع الأجهزة");
      await Promise.all([onChange(), refresh()]);
      window.dispatchEvent(new Event("lesson-media-updated"));
      return true;
    } catch { setError("تعذر الاتصال بالخادم؛ لم يُحفظ التعديل"); return false; }
    finally { setBusy(false); }
  };
  return { busy, error, message, send, setError };
}

function SourceFields({ kind, source, setSource, resetKey }: { kind: "image" | "audio"; source: "uploaded" | "url"; setSource: (v: "uploaded" | "url") => void; resetKey: number }) {
  return <>
    <label className="block text-sm font-bold text-slate-700">طريقة الإضافة
      <select className={field} value={source} onChange={(e) => setSource(e.target.value as "uploaded" | "url")}>
        <option value="uploaded">رفع ملف من الجهاز</option><option value="url">رابط HTTPS مباشر</option>
      </select>
    </label>
    {source === "uploaded" ? <label className="block text-sm font-bold text-slate-700">{kind === "image" ? "الصورة الجديدة (حتى 2 م.ب)" : "المقطع الصوتي (حتى 3 م.ب)"}
      <input key={resetKey} name="file" type="file" required accept={kind === "image" ? "image/png,image/jpeg,image/webp,image/gif" : "audio/*"} className={field} />
      <span className="mt-1 block text-xs font-normal text-slate-500">{kind === "image" ? "PNG أو JPG أو WebP أو GIF. اختر صورة محتشمة مناسبة للطلاب." : "MP3 أو WAV أو OGG أو M4A. للملفات الأكبر استخدم رابطًا مباشرًا."}</span>
    </label> : <label className="block text-sm font-bold text-slate-700">رابط مباشر للوسيط
      <input name="url" type="url" required placeholder="https://example.com/media.mp3" className={field} dir="ltr" />
      <span className="mt-1 block text-xs font-normal text-slate-500">يجب أن يفتح الملف نفسه، لا صفحة مشاهدة أو صفحة تتطلب تسجيل الدخول.</span>
    </label>}
  </>;
}

function ImageCard({ slot, media, onChange }: { slot: (typeof IMAGE_SLOTS)[number]; media?: ManagedMedia; onChange: () => Promise<void> }) {
  const { busy, error, message, send, setError } = useSender(onChange);
  const [source, setSource] = useState<"uploaded" | "url">("uploaded");
  const [resetKey, setResetKey] = useState(0);
  const [broken, setBroken] = useState(false);
  const defaultSrc = slot.defaultSrc ? EMBEDDED_IMAGES[slot.defaultSrc] ?? slot.defaultSrc : null;
  const preview = media?.active ? media.src : defaultSrc;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const alt = String(fd.get("alt") ?? "").trim() || slot.label;
    let fields: Record<string, unknown> = { title: slot.label, alt, active: true, source };
    if (source === "uploaded") {
      const file = fd.get("file");
      if (!(file instanceof File) || !file.size) return;
      if (file.size > MAX_IMAGE_BYTES) { setError("الحد الأقصى للصورة 2 ميغابايت"); return; }
      if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) { setError("اختر صورة PNG أو JPG أو WebP أو GIF"); return; }
      try { fields = { ...fields, mimeType: file.type, dataBase64: await fileBase64(file) }; }
      catch { setError("تعذر قراءة الملف؛ حاول مرة أخرى"); return; }
    } else {
      const url = String(fd.get("url") ?? "").trim();
      try { fields = { ...fields, url, mimeType: urlMime("image", url) }; } catch { return; }
    }
    if (await send({ kind: "image", slot: slot.key, fields })) { form.reset(); setResetKey((v) => v + 1); setBroken(false); }
  };
  return <article className={panel}>
    <div className="mb-3 flex items-start justify-between gap-2"><div><h3 className="font-black text-turq-900">{slot.label}</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">{slot.description}</p></div><span className={cx("shrink-0 rounded-full px-2 py-1 text-xs font-bold", media?.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600")}>{media?.active ? "مخصصة" : "الأصلية"}</span></div>
    <div className="mb-4 grid h-44 place-items-center overflow-hidden rounded-2xl border border-turq-100 bg-turq-50/50 p-2">
      {broken ? <p className="p-4 text-center text-sm font-bold text-rose-700">تعذر تحميل الصورة المخصصة. تحقق من الرابط أو استبدلها.</p> : preview ? <img src={preview} alt={media?.alt || slot.label} className="h-full w-full object-contain" onError={() => setBroken(true)} /> : <SceneArt variant={slot.scene as SceneVariant} className="h-full w-full" />}
    </div>
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-bold text-slate-700">وصف الصورة لقارئ الشاشة<input name="alt" defaultValue={media?.alt || slot.label} maxLength={200} className={field} /></label>
      <SourceFields kind="image" source={source} setSource={setSource} resetKey={resetKey} />
      <Btn type="submit" disabled={busy} className="w-full">{busy ? "جارٍ الحفظ…" : media ? "استبدال الصورة لجميع الأجهزة" : "تخصيص الصورة لجميع الأجهزة"}</Btn>
    </form>
    {media && <button disabled={busy} onClick={() => { if (confirm(`استعادة الصورة الأصلية لموضع «${slot.label}»؟`)) void send({ action: "delete", id: media.id }); }} className="mt-3 w-full rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">استعادة الصورة الأصلية</button>}
    {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-2 text-sm font-bold text-rose-700">{error}</p>}
    {message && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-2 text-xs font-bold text-emerald-800">✓ {message}</p>}
  </article>;
}

function AudioEditor({ media, onChange }: { media: ManagedMedia; onChange: () => Promise<void> }) {
  const { busy, error, message, send } = useSender(onChange);
  const [editing, setEditing] = useState(false);
  return <article className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center gap-2"><span className="text-2xl">🎧</span><div className="min-w-0 flex-1"><h4 className="font-black text-slate-800">{media.title}</h4><p className="text-xs text-slate-500">{SLIDES.find((s) => s.key === media.slideKey)?.title} · {formatBytes(media.sizeBytes)} · {media.source === "url" ? "رابط مباشر" : "ملف محفوظ في قاعدة البيانات"}</p></div><span className={cx("rounded-full px-2 py-1 text-xs font-bold", media.active ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>{media.active ? "ظاهر للطلاب" : "مخفي"}</span></div>
    {media.active ? <audio controls preload="none" src={media.src} className="mt-3 w-full" aria-label={media.title} /> : <p className="mt-3 text-xs text-slate-500">فعّل المقطع لمعاينته وتشغيله.</p>}
    <div className="mt-3 flex flex-wrap gap-2"><Btn size="sm" variant="secondary" onClick={() => setEditing((v) => !v)}>{editing ? "إغلاق التعديل" : "تعديل العنوان والمحطة"}</Btn><Btn size="sm" variant="ghost" disabled={busy} onClick={() => void send({ action: "toggle", id: media.id, active: !media.active })}>{media.active ? "إخفاء" : "إظهار للطلاب"}</Btn><Btn size="sm" variant="ghost" disabled={busy} onClick={() => { if (confirm(media.legacyAudioId ? "إخفاء المقطع القديم من مكتبة الدرس مع حفظ ملفه الأصلي؟" : "حذف هذا المقطع من مكتبة الدرس؟")) void send({ action: "delete", id: media.id }); }}>{media.legacyAudioId ? "إخفاء من المكتبة" : "حذف"}</Btn></div>
    {editing && <form className="mt-3 grid gap-3 rounded-2xl bg-slate-50 p-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); void send({ action: "updateAudio", id: media.id, title: String(fd.get("title") ?? ""), slideKey: String(fd.get("slideKey") ?? "intro"), active: fd.get("active") === "on" }).then((ok) => { if (ok) setEditing(false); }); }}><label className="text-sm font-bold">العنوان<input name="title" required defaultValue={media.title} maxLength={120} className={field} /></label><label className="text-sm font-bold">المحطة<select name="slideKey" defaultValue={media.slideKey ?? "intro"} className={field}>{SLIDES.map((s, i) => <option key={s.key} value={s.key}>{i + 1}. {s.title}</option>)}</select></label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="active" defaultChecked={media.active} /> ظاهر للطلاب</label><Btn type="submit" disabled={busy}>حفظ التعديل</Btn></form>}
    {error && <p role="alert" className="mt-2 text-sm font-bold text-rose-700">{error}</p>}{message && <p role="status" className="mt-2 text-xs font-bold text-emerald-700">✓ {message}</p>}
  </article>;
}

export default function MediaManager({ media, onChange }: { media: ManagedMedia[]; onChange: () => Promise<void> }) {
  const [tab, setTab] = useState<"images" | "audio">("images");
  const [source, setSource] = useState<"uploaded" | "url">("uploaded");
  const [resetKey, setResetKey] = useState(0);
  const { busy, error, message, send, setError } = useSender(onChange);
  const images = media.filter((m) => m.kind === "image");
  const clips = media.filter((m) => m.kind === "audio");
  const imageFor = (slot: ImageSlot) => images.find((m) => m.slot === slot);
  const addAudio = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get("title") ?? "").trim();
    const slideKey = String(fd.get("slideKey") ?? "intro");
    let fields: Record<string, unknown> = { title, source, active: true, alt: "" };
    if (source === "uploaded") {
      const file = fd.get("file");
      if (!(file instanceof File) || !file.size) return;
      if (file.size > MAX_AUDIO_BYTES) { setError("الحد الأقصى للمقطع 3 ميغابايت؛ استخدم رابطًا مباشرًا للملفات الأكبر"); return; }
      const ext = file.name.toLowerCase().split(".").pop();
      const mime = file.type || (ext === "wav" ? "audio/wav" : ext === "ogg" ? "audio/ogg" : ext === "m4a" ? "audio/x-m4a" : ext === "webm" ? "audio/webm" : "audio/mpeg");
      if (!(AUDIO_MIME_TYPES as readonly string[]).includes(mime)) { setError("نوع المقطع غير مدعوم؛ اختر MP3 أو WAV أو OGG أو M4A"); return; }
      try { fields = { ...fields, mimeType: mime, dataBase64: await fileBase64(file) }; }
      catch { setError("تعذر قراءة المقطع؛ حاول مرة أخرى"); return; }
    } else {
      const url = String(fd.get("url") ?? "").trim();
      try { fields = { ...fields, url, mimeType: urlMime("audio", url) }; } catch { return; }
    }
    if (await send({ kind: "audio", slideKey, fields })) { form.reset(); setResetKey((v) => v + 1); }
  };
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-black text-turq-900">الصور والصوتيات</h1><p className="mt-2 max-w-3xl leading-relaxed text-slate-600">عدّل وسائط الدرس مرة واحدة لتظهر لجميع الطلاب على الجوال والحاسوب والسبورة الذكية. تُحفظ التعديلات في قاعدة بيانات الدرس، ويتحقق الطلاب من التحديثات تلقائيًا كل 30 ثانية وعند العودة للصفحة.</p></div>
    <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-sm"><Btn variant={tab === "images" ? "primary" : "ghost"} onClick={() => setTab("images")}>🖼️ صور الدرس ({images.filter((m) => m.active).length} مخصصة)</Btn><Btn variant={tab === "audio" ? "primary" : "ghost"} onClick={() => setTab("audio")}>🎧 المقاطع الصوتية ({clips.length})</Btn></div>
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-relaxed text-sky-900"><b>مهم:</b> استخدم صورًا ومقاطع تملك حق استخدامها، وحافظ على المحتوى التعليمي المعتمد. الصور الأصلية المدمجة تبقى احتياطًا تلقائيًا. انتشار التعديل يتطلب اتصال الجهاز بنفس نسخة الموقع وقاعدة بيانات الإنتاج.</div>
    {tab === "images" ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{IMAGE_SLOTS.map((slot) => <ImageCard key={`${slot.key}-${imageFor(slot.key)?.updatedAt ?? "default"}`} slot={slot} media={imageFor(slot.key)} onChange={onChange} />)}</div> : <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
      <section className={panel}><h2 className="mb-4 text-xl font-black text-turq-900">إضافة مقطع صوتي</h2><form onSubmit={addAudio} className="space-y-4"><label className="block text-sm font-bold">عنوان المقطع<input name="title" required maxLength={120} placeholder="مثال: شرح شرط الطهارة" className={field} /></label><label className="block text-sm font-bold">المحطة التي يظهر فيها<select name="slideKey" required className={field}>{SLIDES.map((s, i) => <option key={s.key} value={s.key}>{i + 1}. {s.title}</option>)}</select></label><SourceFields kind="audio" source={source} setSource={setSource} resetKey={resetKey} /><Btn type="submit" disabled={busy} className="w-full">{busy ? "جارٍ الحفظ…" : "حفظ المقطع لجميع الأجهزة"}</Btn></form>{error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}{message && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">✓ {message}</p>}<p className="mt-4 text-xs leading-relaxed text-slate-500">المقاطع المرفوعة تُحفظ فعليًا في PostgreSQL. المقاطع القديمة للمعلم تُنقل إلى هذه المكتبة دون حذف الملفات الأصلية، وتظهر في المحطة المرتبطة بها.</p></section>
      <section className="space-y-3"><h2 className="text-xl font-black text-turq-900">مقاطع الدرس</h2>{clips.length ? clips.map((clip) => <AudioEditor key={`${clip.id}-${clip.updatedAt}`} media={clip} onChange={onChange} />) : <div className={cx(panel, "py-12 text-center text-slate-500")}><div className="mb-3 text-5xl">🎧</div><p className="font-bold">لا توجد مقاطع بعد</p><p className="mt-1 text-sm">أضف أول شرح صوتي، وسيظهر مشغله أعلى المحطة المختارة.</p></div>}</section>
    </div>}
  </div>;
}
