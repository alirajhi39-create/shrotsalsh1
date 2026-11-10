"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { authFetch, getToken, setToken, teacherFetch } from "@/lib/client-auth";
import { ACTIVITIES, SKILLS, SLIDES } from "@/lib/content";
import { KIND_LABELS, humanizeActivityAnswer, humanizeResponse } from "@/lib/grading";
import { BarChart, ColumnChart, Donut, StatCard } from "./charts";

import MediaManager from "./MediaManager";
import LiveQuizBoard from "./LiveQuizBoard";
import ActivityRulesSettings from "./ActivityRulesSettings";
import type { ActivityRules } from "@/lib/activity-rules";
import type { ManagedMedia } from "@/lib/media";
import IframeHint from "@/components/IframeHint";
import { Btn, cx } from "@/components/lesson/ui";

/* ------------------------------------------------------------------ */
/*  الأنواع                                                            */
/* ------------------------------------------------------------------ */

type StudentRow = {
  id: number;
  name: string;
  classroomId: number;
  classroom: string;
  resumeCode: string;
  locked: boolean;
  createdAt: string;
  currentSlide: number | null;
  completedSlides: string[];
  completionPct: number;
  points: number;
  stars: number;
  attempts: number;
  bestPercent: number | null;
  pendingReview: boolean;
  certificateSerial: string | null;
  completedAt: string | null;
  updatedAt: string | null;
  weakSkills: string[];
};

type QuestionRow = {
  id: number;
  slideKey: string;
  kind: string;
  prompt: string;
  options: Record<string, unknown>;
  answer: Record<string, unknown>;
  explanation: string;
  skill: string;
  points: number;
  active: boolean;
};

type SlideRow = { id: number; key: string; title: string; subtitle: string; videoUrl: string | null };
type Room = { id: number; name: string; active: boolean };
type AudioRow = { id: number; title: string; slideKey: string; createdAt: string };

type Data = {
  ok: boolean;
  teacher: { id: number; name: string; school: string } | null;
  lessonId: number;
  passPercent: number;
  settings: { passPercent: number; maxAttempts: number; allowAudio: boolean; soundsEnabled: boolean; allowSkip: boolean; activityRules: ActivityRules; videoUrl: string | null };
  rooms: Room[];
  students: StudentRow[];
  pendingReviewCount: number;
  questions: QuestionRow[];
  slides: SlideRow[];
  teacherAudios: AudioRow[];
  media: ManagedMedia[];
  recentLogs: { id: number; actorId: number | null; action: string; createdAt: string }[];
};

type AnswerRow = {
  id: number;
  studentId: number;
  slideKey: string;
  activityKey: string;
  questionId: number | null;
  attemptId: number;
  answer: unknown;
  isCorrect: boolean | null;
  score: number;
  maxScore: number;
  needsReview: boolean;
  teacherScore: number | null;
  teacherFeedback: string | null;
  createdAt: string;
  updatedAt: string;
};

type AttemptRow = {
  id: number;
  attemptNumber: number;
  percent: number;
  autoScore: number;
  maxAutoScore: number;
  teacherScore: number;
  maxTeacherScore: number;
  pendingReview: boolean;
  skillReport: Record<string, { earned: number; max: number }>;
  submittedAt: string;
};

type Detail = {
  ok: boolean;
  student: { id: number; name: string; classroomId: number; classroom: string; resumeCode: string; locked: boolean; createdAt: string };
  rooms: Room[];
  maxAttempts: number;
  allowAudio: boolean;
  progress: { currentSlide: number; completedSlides: string[]; points: number; stars: number; extraAttempts: number; completedAt: string | null } | null;
  answers: AnswerRow[];
  attempts: AttemptRow[];
  achievements: { key: string; title: string; icon: string; earnedAt: string }[];
  certificate: { serial: string; percent: number; issuedAt: string } | null;
  audios: AudioRow[];
  questions: { id: number; kind: string; prompt: string; options: Record<string, unknown>; answer: Record<string, unknown> }[];
};

type Tab = "overview" | "students" | "questions" | "media" | "board" | "settings";

/* ------------------------------------------------------------------ */
/*  أدوات                                                              */
/* ------------------------------------------------------------------ */

const input = "w-full rounded-xl border-2 border-slate-200 p-2 focus:border-turq-400 focus:outline-none";
const card = "rounded-3xl bg-white p-5 shadow";
const slideTitle = (k: string) => SLIDES.find((s) => s.key === k)?.title ?? k;

function isStruggling(s: StudentRow, passPercent: number) {
  if (s.bestPercent !== null && s.bestPercent < passPercent) return true;
  if (s.weakSkills.length > 0) return true;
  if (s.updatedAt && !s.completedAt && s.completionPct < 50 && Date.now() - new Date(s.updatedAt).getTime() > 7 * 24 * 3600 * 1000) return true;
  return false;
}

function TeacherAudio({ id }: { id: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const r = await authFetch("teacher", `/api/teacher/audio/${id}`);
        if (!r.ok) throw new Error("audio");
        const blob = await r.blob();
        url = URL.createObjectURL(blob);
        if (!cancelled) setSrc(url);
      } catch {
        if (!cancelled) setErr(true);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  if (err) return <span className="text-xs text-rose-600">تعذر تحميل التسجيل</span>;
  return src ? <audio controls preload="none" src={src} className="mt-2 w-full" /> : <span className="text-xs text-slate-500">جارٍ تحميل التسجيل…</span>;
}

function ConfirmButton({ onConfirm, message, children, className }: { onConfirm: () => void; message: string; children: ReactNode; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => confirm(message) && onConfirm()}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  تسجيل دخول المعلم (داخل التطبيق أيضًا عند فقدان الجلسة)              */
/* ------------------------------------------------------------------ */

export function TeacherLoginInline({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setError(data.error ?? "تعذر تسجيل الدخول");
        return;
      }
      setToken("teacher", data.token);
      onLogin(data.token);
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-md">
      <IframeHint />
      <div className={card}>
        <div className="mb-4 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-turq-500 to-brand-blue text-3xl text-white">👨‍🏫</div>
          <h1 className="mt-3 text-2xl font-black text-turq-900">دخول المعلم</h1>
          <p className="text-sm text-slate-500">لوحة تحكم درس «شروط الصلاة (1)»</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block font-bold text-slate-700">
            كلمة مرور المعلم
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus autoComplete="current-password" className="mt-1 w-full rounded-2xl border-2 border-slate-200 p-3 text-center text-2xl tracking-widest focus:border-turq-400 focus:outline-none" />
          </label>
          {error && <div className="rounded-2xl bg-rose-50 p-3 font-bold text-rose-700">{error}</div>}
          <button disabled={busy} className="w-full rounded-2xl bg-turq-600 py-3 text-lg font-black text-white shadow-lg hover:bg-turq-700 disabled:opacity-50">
            {busy ? "لحظة…" : "دخول"}
          </button>
        </form>

        <div className="mt-3 text-center">
          <Link href="/" className="text-sm font-bold text-turq-700">→ صفحة الطلاب</Link>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  محرر الأسئلة                                                       */
/* ------------------------------------------------------------------ */

const KINDS = ["mcq", "situation", "fill", "truefalse", "multi", "order", "dragdrop", "essay"];

function QuestionEditor({ question, onSave, onClose }: { question: QuestionRow | null; onSave: (q: Record<string, unknown>) => Promise<boolean>; onClose?: () => void }) {
  const [kind, setKind] = useState(question?.kind ?? "mcq");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = question;
  const lines = (v: unknown) => (Array.isArray(v) ? (v as string[]).join("\n") : "");
  const mapLines = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? Object.entries(v as Record<string, string>).map(([k, x]) => `${k}=${x}`).join("\n") : "");
  const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const o = rec(q?.options);
  const a = rec(q?.answer);
  const indices = Array.isArray(a.indices) ? (a.indices as number[]).map((i) => i + 1).join("، ") : "";
  const keywords = Array.isArray(a.keywords) ? (a.keywords as string[]).join("، ") : "";

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const g = (k: string) => String(fd.get(k) ?? "").trim();
    const L = (k: string) => g(k).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    let options: Record<string, unknown> = {};
    let answer: Record<string, unknown> = {};
    switch (kind) {
      case "mcq":
      case "situation":
      case "fill": {
        const choices = L("choices");
        const index = Number(g("correctIndex"));
        if (choices.length < 2 || !Number.isInteger(index) || index < 0 || index >= choices.length) return setError("أدخل خيارين على الأقل وحدد رقم الإجابة الصحيحة");
        options = { choices };
        answer = { index };
        break;
      }
      case "truefalse":
        answer = { value: g("tfValue") === "true" };
        break;
      case "multi": {
        const choices = L("choices");
        const ids = g("correctIndices").split(/[،,\s]+/).map(Number).filter(Number.isInteger).map((x) => x - 1);
        if (choices.length < 2 || !ids.length || ids.some((i) => i < 0 || i >= choices.length)) return setError("تحقق من الخيارات وأرقام الإجابات الصحيحة");
        options = { choices };
        answer = { indices: Array.from(new Set(ids)) };
        break;
      }
      case "order": {
        const words = L("orderWords");
        if (words.length < 2) return setError("أدخل كلمتين على الأقل بالترتيب الصحيح");
        options = { words };
        answer = { order: words };
        break;
      }
      case "dragdrop": {
        const pairs = L("pairs").map((l) => l.split("=").map((x) => x.trim())).filter((x) => x.length === 2 && x[0] && x[1]);
        if (pairs.length < 2) return setError("أدخل سطرين على الأقل بصيغة: العنصر=المنطقة");
        const map = Object.fromEntries(pairs);
        options = { items: pairs.map((x) => x[0]), zones: Array.from(new Set(pairs.map((x) => x[1]))) };
        answer = { map };
        break;
      }
      case "essay":
        options = { minLength: 5 };
        answer = { modelAnswer: g("modelAnswer"), keywords: g("keywords").split(/[،,\s]+/).filter(Boolean) };
        break;
    }
    setBusy(true);
    const ok = await onSave({
      ...(q ? { id: q.id } : {}),
      slideKey: g("slideKey"),
      kind,
      prompt: g("prompt"),
      options,
      answer,
      explanation: g("explanation"),
      skill: g("skill"),
      points: Number(g("points")) || 1,
      active: fd.get("active") === "on",
    });
    setBusy(false);
    if (ok) onClose?.();
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border-2 border-turq-200 bg-turq-50/40 p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm font-bold">الموضع<select name="slideKey" defaultValue={q?.slideKey ?? "quiz"} className={input}><option value="quiz">التقويم الختامي</option><option value="book">نشاط الكتاب</option></select></label>
        <label className="text-sm font-bold">النوع<select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={input}>{KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select></label>
        <label className="text-sm font-bold">المهارة<select name="skill" defaultValue={q?.skill ?? SKILLS[0]} className={input}>{SKILLS.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="text-sm font-bold">الدرجات<input name="points" type="number" min={1} max={10} defaultValue={q?.points ?? 1} className={input} /></label>
      </div>
      <label className="block text-sm font-bold">نص السؤال<textarea name="prompt" rows={2} required defaultValue={q?.prompt ?? ""} className={input} /></label>
      {["mcq", "situation", "fill"].includes(kind) && (
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <label className="text-sm font-bold">الخيارات (كل خيار في سطر)<textarea name="choices" rows={4} defaultValue={lines(o.choices)} className={input} /></label>
          <label className="text-sm font-bold">رقم الإجابة الصحيحة (يبدأ من 0)<input name="correctIndex" type="number" min={0} defaultValue={typeof a.index === "number" ? a.index : 0} className={input} /></label>
        </div>
      )}
      {kind === "truefalse" && <label className="block text-sm font-bold">الإجابة الصحيحة<select name="tfValue" defaultValue={a.value === false ? "false" : "true"} className={input}><option value="true">صح</option><option value="false">خطأ</option></select></label>}
      {kind === "multi" && (
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="text-sm font-bold">الخيارات (كل خيار في سطر)<textarea name="choices" rows={4} defaultValue={lines(o.choices)} className={input} /></label>
          <label className="text-sm font-bold">أرقام الإجابات الصحيحة (من 1)<input name="correctIndices" defaultValue={indices} placeholder="1، 3" className={input} /></label>
        </div>
      )}
      {kind === "order" && <label className="block text-sm font-bold">الكلمات بالترتيب الصحيح (كل مقطع في سطر)<textarea name="orderWords" rows={4} defaultValue={lines(a.order)} className={input} /></label>}
      {kind === "dragdrop" && <label className="block text-sm font-bold">الأزواج: العنصر=المنطقة<textarea name="pairs" rows={4} defaultValue={mapLines(a.map)} className={input} /></label>}
      {kind === "essay" && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-bold">الإجابة النموذجية<textarea name="modelAnswer" rows={3} defaultValue={typeof a.modelAnswer === "string" ? a.modelAnswer : ""} className={input} /></label>
          <label className="text-sm font-bold">كلمات مفتاحية<input name="keywords" defaultValue={keywords} className={input} /></label>
        </div>
      )}
      <label className="block text-sm font-bold">التغذية الراجعة<input name="explanation" defaultValue={q?.explanation ?? ""} className={input} /></label>
      {error && <p className="rounded-xl bg-rose-50 p-2 text-sm font-bold text-rose-700">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="active" defaultChecked={q?.active ?? true} className="h-5 w-5" /> مفعّل</label>
        <button disabled={busy} className="rounded-xl bg-turq-600 px-5 py-2 font-bold text-white">{busy ? "جارٍ الحفظ…" : "💾 حفظ السؤال"}</button>
        {onClose && <button type="button" onClick={onClose} className="rounded-xl bg-slate-200 px-4 py-2 font-bold text-slate-700">إلغاء</button>}
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  التطبيق الرئيسي                                                     */
/* ------------------------------------------------------------------ */

export default function TeacherApp({ initialTab = "overview", initialStudentId }: { initialTab?: Tab; initialStudentId?: number }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [selectedInit] = useState<number | null>(initialStudentId ?? null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const [filter, setFilter] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  const flash = useCallback((text: string, error = false) => {
    setToast({ text, error });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const loadData = useCallback(async () => {
    if (!getToken("teacher")) {
      setAuthed(false);
      setData(null);
      return;
    }
    const res = await teacherFetch("/api/teacher/data");
    if (res.status === 401) {
      setToken("teacher", null);
      setAuthed(false);
      setData(null);
      return;
    }
    const json = (await res.json()) as Data;
    setData(json);
    setAuthed(true);
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    setSelected(id);
    setDetail(null);
    const res = await teacherFetch(`/api/teacher/student/${id}`);
    if (res.ok) setDetail((await res.json()) as Detail);
    else flash("تعذر تحميل بيانات الطالب", true);
  }, [flash]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (authed && selected) loadDetail(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  useEffect(() => {
    if (authed && selectedInit && !selected) loadDetail(selectedInit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, selectedInit]);

  const act = useCallback(
    async (action: string, payload: Record<string, unknown> = {}, after?: () => Promise<void> | void) => {
      setBusy(true);
      try {
        const res = await teacherFetch("/api/teacher/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, payload }),
        });
        const json = (await res.json()) as { msg?: string; error?: string };
        flash(json.msg ?? json.error ?? "تم التنفيذ", !res.ok);
        if (res.ok) {
          await loadData();
          if (after) await after();
        }
        return res.ok;
      } catch {
        flash("تعذر الاتصال بالخادم", true);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [flash, loadData],
  );

  const downloadPdf = async (studentId?: number) => {
    setBusy(true);
    try {
      const query = studentId ? `studentId=${studentId}` : filter ? `classroomId=${filter}` : "";
      const res = await authFetch("teacher", `/api/teacher/reports/pdf${query ? `?${query}` : ""}`);
      if (!res.ok) { const d = await res.json().catch(() => ({})); return flash(d.error ?? "تعذر إنشاء تقرير PDF", true); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = studentId ? `تقرير-الطالب-${studentId}.pdf` : `تقرير-${filter ? rooms.find(r => r.id === filter)?.name ?? "الفصل" : "جميع-الفصول"}.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      flash("تم تنزيل تقرير PDF");
    } catch { flash("تعذر تنزيل التقرير", true); } finally { setBusy(false); }
  };

  const download = async (format: "csv" | "xlsx") => {
    const url = `/api/teacher/export?format=${format}${filter ? `&classroomId=${filter}` : ""}`;
    const res = await authFetch("teacher", url);
    if (!res.ok) return flash("تعذر تصدير النتائج", true);
    const blob = await res.blob();
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `نتائج-شروط-الصلاة.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 2000);
  };

  if (authed === false) {
    return (
      <div className="min-h-screen p-4">
        <TeacherLoginInline onLogin={() => { setAuthed(true); loadData(); }} />
      </div>
    );
  }
  if (authed === null || !data) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-8 border-turq-200 border-t-turq-600" />
          <p className="text-lg font-bold text-turq-800">جارٍ تحميل لوحة المعلم…</p>
        </div>
      </div>
    );
  }

  const { students, passPercent, rooms, settings, slides, questions } = data;
  const started = students.filter((s) => s.completedSlides.length > 0 || s.currentSlide);
  const withAttempt = students.filter((s) => s.bestPercent !== null);
  const avg = withAttempt.length ? withAttempt.reduce((a, s) => a + (s.bestPercent ?? 0), 0) / withAttempt.length : 0;
  const passed = withAttempt.filter((s) => (s.bestPercent ?? 0) >= passPercent).length;
  const finished = students.filter((s) => s.completedAt);
  const certified = students.filter((s) => s.certificateSerial);
  const struggling = students.filter((s) => isStruggling(s, passPercent));
  const base = Math.max(1, started.length);
  const stationData = SLIDES.map((s) => ({ label: s.title, value: (students.filter((x) => x.completedSlides.includes(s.key)).length / base) * 100 }));
  const classData = rooms.map((r) => {
    const mine = students.filter((x) => x.classroomId === r.id && x.bestPercent !== null);
    return { label: r.name, value: mine.length ? mine.reduce((a, x) => a + (x.bestPercent ?? 0), 0) / mine.length : 0, color: "#1fadab" };
  });
  const skillData = SKILLS.map((sk) => ({ label: sk, value: students.filter((x) => x.weakSkills.includes(sk)).length, color: "#f7931e" }));
  const dist = [
    { label: "أقل من 50", value: withAttempt.filter((x) => (x.bestPercent ?? 0) < 50).length, color: "#f43f5e" },
    { label: "50–79", value: withAttempt.filter((x) => (x.bestPercent ?? 0) >= 50 && (x.bestPercent ?? 0) < 80).length, color: "#f7931e" },
    { label: "80–100", value: withAttempt.filter((x) => (x.bestPercent ?? 0) >= 80).length, color: "#22a06b" },
  ];
  const list = filter ? students.filter((s) => s.classroomId === filter) : students;

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "النظرة العامة", icon: "📊" },
    { key: "students", label: "الطلاب والفصول", icon: "🧑‍🎓" },
    { key: "questions", label: "الأسئلة والأنشطة", icon: "📝" },
    { key: "media", label: "الصور والصوتيات", icon: "🖼️" },
    { key: "board", label: "السبورة الذكية", icon: "🖥️" },
    { key: "settings", label: "الإعدادات", icon: "⚙️" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-turq-500 to-brand-blue text-xl text-white">👨‍🏫</div>
            <div><p className="text-xs text-slate-500">{data.teacher?.school}</p><p className="font-black text-turq-900">{data.teacher?.name}</p></div>
          </div>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto md:order-2 md:w-auto md:flex-1 md:justify-center">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => { setTab(t.key); setSelected(null); }} className={cx("whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition-colors", tab === t.key ? "bg-turq-600 text-white" : "text-slate-700 hover:bg-turq-50")}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
          <div className="order-2 ms-auto flex gap-2 md:order-3">
            <button onClick={() => loadData()} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">🔄 تحديث</button>
            <button onClick={() => window.print()} className="no-print rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">🖨️</button>
            <Link href="/" className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">الطلاب</Link>
            <button onClick={() => { setToken("teacher", null); setAuthed(false); setData(null); }} className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">خروج</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <IframeHint compact />
        {toast && <div className={cx("mb-4 animate-pop rounded-2xl border-2 p-3 font-bold", toast.error ? "border-rose-300 bg-rose-50 text-rose-900" : "border-emerald-300 bg-emerald-50 text-emerald-900")}>{toast.error ? "⚠️ " : "✅ "}{toast.text}</div>}

        {/* ---------------- النظرة العامة ---------------- */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h1 className="text-3xl font-black text-turq-900">النظرة العامة</h1><p className="text-slate-500">بيانات حقيقية من قاعدة البيانات — اضغط «تحديث» لمتابعة التقدم المباشر.</p></div>
              <div className="flex flex-wrap items-center gap-2"><select value={filter} onChange={e=>setFilter(Number(e.target.value))} className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-bold" aria-label="الفصل للتقرير"><option value={0}>جميع الفصول</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select><Btn variant="warning" onClick={() => void downloadPdf()} disabled={busy}>📄 تقرير PDF</Btn><Btn variant="success" onClick={() => download("xlsx")}>⬇️ Excel</Btn><Btn variant="primary" onClick={() => download("csv")}>⬇️ CSV</Btn></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard title="إجمالي الطلاب" value={students.length} hint={`${rooms.length} فصول`} icon="🧑‍🎓" />
              <StatCard title="بدؤوا الدرس" value={started.length} hint={`${students.length ? Math.round((started.length / students.length) * 100) : 0}%`} icon="🚀" tone="blue" />
              <StatCard title="متوسط الاختبار" value={`${Math.round(avg)}%`} hint={`${passed} اجتازوا من ${withAttempt.length}`} icon="📝" tone="orange" />
              <StatCard title="أكملوا الدرس" value={finished.length} hint={`${certified.length} شهادة`} icon="🎓" tone="green" />
              <StatCard title="بانتظار التصحيح" value={data.pendingReviewCount} hint="إجابات كتابية" icon="⏳" tone="rose" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <section className={card}><h2 className="mb-4 text-xl font-black text-turq-900">نسبة إكمال كل محطة</h2><BarChart data={stationData} /></section>
              <div className="space-y-6">
                <section className={card}><h2 className="mb-4 text-xl font-black text-turq-900">مقارنة متوسط الاختبار بين الفصول</h2><ColumnChart data={classData} /></section>
                <section className="grid gap-4 rounded-3xl bg-white p-5 shadow sm:grid-cols-2">
                  <Donut percent={students.length ? (finished.length / students.length) * 100 : 0} label="نسبة إكمال الدرس" />
                  <Donut percent={withAttempt.length ? (passed / withAttempt.length) * 100 : 0} label={`نسبة الاجتياز (${passPercent}%)`} color="#1e6fd9" />
                </section>
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <section className={card}><h2 className="mb-4 text-xl font-black text-turq-900">توزيع درجات الاختبار</h2><ColumnChart data={dist} max={Math.max(1, withAttempt.length)} suffix="" /></section>
              <section className={card}><h2 className="mb-4 text-xl font-black text-turq-900">المهارات التي تحتاج مراجعة</h2><BarChart data={skillData} max={Math.max(1, students.length)} suffix=" طالب" /></section>
            </div>
            <section className={card}>
              <h2 className="mb-1 text-xl font-black text-turq-900">الطلاب المتعثرون ({struggling.length})</h2>
              {struggling.length === 0 ? <p className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-800">لا يوجد طلاب متعثرون 🎉</p> : (
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className="p-2 text-start">الطالب</th><th className="p-2 text-start">الفصل</th><th className="p-2">الإكمال</th><th className="p-2">النتيجة</th><th className="p-2 text-start">المراجعة</th><th></th></tr></thead><tbody>
                  {struggling.map((s) => <tr key={s.id} className="border-t"><td className="p-2 font-bold">{s.name}</td><td className="p-2">{s.classroom}</td><td className="p-2 text-center">{s.completionPct}%</td><td className="p-2 text-center">{s.bestPercent === null ? "—" : `${Math.round(s.bestPercent)}%`}</td><td className="p-2">{s.weakSkills.join("، ") || "—"}</td><td className="p-2"><button onClick={() => { setTab("students"); loadDetail(s.id); }} className="font-bold text-turq-700 hover:underline">عرض</button></td></tr>)}
                </tbody></table></div>
              )}
            </section>
            <section className={card}>
              <h2 className="mb-3 text-xl font-black text-turq-900">آخر نشاط</h2>
              {data.recentLogs.length === 0 ? <p className="text-sm text-slate-500">لا يوجد نشاط بعد.</p> : <ul className="grid gap-2 text-sm sm:grid-cols-2">{data.recentLogs.map((l) => { const labels: Record<string, string> = { student_created: "سجّل في الدرس", student_resumed: "عاد للمتابعة", quiz_submitted: "أرسل اختبارًا", certificate_issued: "حصل على الشهادة", audio_uploaded: "رفع تسجيلًا", resume_code_failed: "رمز استكمال خاطئ" }; return <li key={l.id} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2"><span><b>{students.find((x) => x.id === l.actorId)?.name ?? `طالب #${l.actorId}`}</b> — {labels[l.action] ?? l.action}</span><span className="text-slate-500">{new Date(l.createdAt).toLocaleString("ar-SA")}</span></li>; })}</ul>}
            </section>
          </div>
        )}

        {/* ---------------- الطلاب ---------------- */}
        {tab === "students" && !selected && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-black text-turq-900">الطلاب والفصول</h1><div className="flex gap-2"><Btn variant="success" size="sm" onClick={() => download("xlsx")}>⬇️ Excel</Btn><Btn variant="secondary" size="sm" onClick={() => download("csv")}>⬇️ CSV</Btn></div></div>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className={card}>
                <h2 className="mb-3 text-lg font-black text-turq-900">الفصول</h2>
                <ul className="space-y-2">{rooms.map((r) => { const count = students.filter((x) => x.classroomId === r.id).length; return <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2"><button onClick={() => setFilter(filter === r.id ? 0 : r.id)} className="font-bold text-turq-800">🏫 {r.name}</button><span className="text-sm text-slate-500">({count} طالب)</span>{!r.active && <span className="rounded-full bg-rose-100 px-2 text-xs font-bold text-rose-700">موقوف</span>}<div className="ms-auto flex gap-1"><button onClick={() => act("toggleClassroom", { id: r.id })} className="rounded-lg bg-white px-2 py-1 text-xs font-bold shadow-sm">{r.active ? "إيقاف" : "تفعيل"}</button>{count === 0 && <ConfirmButton message={`حذف فصل ${r.name}؟`} onConfirm={() => act("deleteClassroom", { id: r.id })} className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">حذف</ConfirmButton>}</div></li>; })}</ul>
                <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act("addClassroom", { name: String(f.get("name") ?? "") }); e.currentTarget.reset(); }} className="mt-3 flex gap-2"><input name="name" required placeholder="اسم فصل جديد" className={input} /><button className="rounded-xl bg-turq-600 px-4 font-bold text-white">➕ إضافة</button></form>
              </section>
              <section className={card}>
                <h2 className="mb-1 text-lg font-black text-turq-900">إضافة طالب (اسم مثبّت)</h2>
                <p className="mb-3 text-sm text-slate-500">يحصل الطالب على رمز استكمال يظهر في رسالة النجاح وفي الجدول أدناه.</p>
                <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act("addStudent", { name: String(f.get("name") ?? ""), classroomId: Number(f.get("classroomId") ?? rooms[0]?.id ?? 0) }); e.currentTarget.reset(); }} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"><input name="name" required minLength={2} placeholder="اسم الطالب" className={input} /><select name="classroomId" className={input} defaultValue={filter || rooms[0]?.id}>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select><button className="rounded-xl bg-brand-orange px-4 py-2 font-bold text-white">➕ إضافة</button></form>
              </section>
            </div>
            <section className={card}>
              <div className="mb-3 flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-turq-900">قائمة الطلاب ({list.length})</h2><div className="ms-auto flex flex-wrap gap-1"><button onClick={() => setFilter(0)} className={cx("rounded-xl px-3 py-1 text-sm font-bold", !filter ? "bg-turq-600 text-white" : "bg-slate-100")}>الكل</button>{rooms.map((r) => <button key={r.id} onClick={() => setFilter(r.id)} className={cx("rounded-xl px-3 py-1 text-sm font-bold", filter === r.id ? "bg-turq-600 text-white" : "bg-slate-100")}>{r.name}</button>)}</div></div>
              {list.length === 0 ? <p className="rounded-2xl bg-slate-50 p-6 text-center text-slate-500">لا يوجد طلاب بعد.</p> : (
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className="p-2 text-start">الطالب</th><th className="p-2 text-start">الفصل</th><th className="p-2">الرمز</th><th className="p-2 text-start">المحطة</th><th className="p-2">الإكمال</th><th className="p-2">النقاط</th><th className="p-2">الاختبار</th><th className="p-2">الحالة</th><th></th></tr></thead><tbody>
                  {list.map((s) => <tr key={s.id} className="border-t hover:bg-turq-50/40"><td className="p-2 font-bold">{s.locked && "📌 "}{s.name}</td><td className="p-2">{s.classroom}</td><td className="p-2 text-center font-mono font-bold tracking-widest text-orange-700">{s.resumeCode}</td><td className="p-2">{s.currentSlide !== null ? `${(s.currentSlide ?? 0) + 1}. ${SLIDES[s.currentSlide ?? 0]?.title ?? ""}` : "لم يبدأ"}</td><td className="p-2"><div className="flex items-center gap-2"><div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-turq-500" style={{ width: `${s.completionPct}%` }} /></div>{s.completionPct}%</div></td><td className="p-2 text-center">🏅{s.points} ⭐{s.stars}</td><td className="p-2 text-center">{s.bestPercent === null ? "—" : `${Math.round(s.bestPercent)}% (${s.attempts})`}</td><td className="p-2 text-center">{s.certificateSerial ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">🎓 شهادة</span> : s.pendingReview ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">⏳ تصحيح</span> : isStruggling(s, passPercent) ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">متعثر</span> : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold">مستمر</span>}</td><td className="p-2"><button onClick={() => loadDetail(s.id)} className="rounded-xl bg-turq-50 px-3 py-1 font-bold text-turq-700">التفاصيل</button></td></tr>)}
                </tbody></table></div>
              )}
            </section>
          </div>
        )}

        {/* ---------------- تفاصيل الطالب ---------------- */}
        {tab === "students" && selected && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3"><button onClick={() => { setSelected(null); setDetail(null); }} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-turq-700 shadow">→ قائمة الطلاب</button><h1 className="text-3xl font-black text-turq-900">{detail?.student.name ?? "…"}</h1>{detail && <span className="rounded-full bg-turq-100 px-3 py-1 font-bold text-turq-800">{detail.student.classroom}</span>}<Btn variant="warning" size="sm" className="ms-auto" onClick={() => selected && void downloadPdf(selected)} disabled={busy || !detail}>📄 تقرير PDF للطالب</Btn></div>
            {!detail ? <div className={card}>جارٍ تحميل بيانات الطالب…</div> : (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className={card}><p className="text-xs text-slate-500">التقدم</p><p className="text-3xl font-black text-turq-900">{Math.round((detail.progress?.completedSlides.length ?? 0) / SLIDES.length * 100)}%</p></div>
                  <div className={card}><p className="text-xs text-slate-500">النقاط / النجوم</p><p className="text-3xl font-black text-turq-900">🏅 {detail.progress?.points ?? 0} ⭐ {detail.progress?.stars ?? 0}</p><p className="text-xs">{detail.achievements.map((a) => a.icon).join(" ")}</p></div>
                  <div className={card}><p className="text-xs text-slate-500">أفضل نتيجة</p><p className="text-3xl font-black text-turq-900">{detail.attempts.length ? `${Math.round(Math.max(...detail.attempts.map((a) => a.percent)))}%` : "—"}</p><p className="text-xs">المحاولات: {detail.attempts.length} / {detail.maxAttempts + (detail.progress?.extraAttempts ?? 0)}</p></div>
                  <div className={card}><p className="text-xs text-slate-500">رمز الاستكمال</p><p className="font-mono text-3xl font-black tracking-widest text-orange-700">{detail.student.resumeCode}</p></div>
                </div>
                <section className={cx(card, "no-print grid gap-4 lg:grid-cols-2")}>
                  <div><h2 className="mb-3 text-lg font-black text-turq-900">تعديل بيانات الطالب</h2><form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act("updateStudent", { id: selected, name: String(f.get("name") ?? ""), classroomId: Number(f.get("classroomId") ?? 0), locked: f.get("locked") === "on" }, () => loadDetail(selected)); }} className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]"><input name="name" defaultValue={detail.student.name} required className={input} /><select name="classroomId" defaultValue={detail.student.classroomId} className={input}>{detail.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="locked" defaultChecked={detail.student.locked} className="h-5 w-5" /> تثبيت</label><button className="rounded-xl bg-turq-600 px-4 py-2 font-bold text-white">حفظ</button></form></div>
                  <div><h2 className="mb-3 text-lg font-black text-turq-900">إجراءات</h2><div className="flex flex-wrap gap-2">
                    <Btn size="sm" variant="warning" onClick={() => act("grantExtraAttempt", { id: selected }, () => loadDetail(selected))}>🔁 محاولة إضافية</Btn>
                    {detail.certificate ? <><Link href={`/certificate/${detail.certificate.serial}`} className="rounded-xl bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-800">🎓 الشهادة</Link><ConfirmButton message="إلغاء الشهادة؟" onConfirm={() => act("revokeCertificate", { id: selected }, () => loadDetail(selected))} className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">إلغاء الشهادة</ConfirmButton></> : <ConfirmButton message="إصدار شهادة يدويًا (تجاوز الشروط)؟" onConfirm={() => act("issueCertificate", { id: selected }, () => loadDetail(selected))} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white">🎓 إصدار شهادة</ConfirmButton>}
                    <ConfirmButton message="توليد رمز جديد وإنهاء الجلسات؟" onConfirm={() => act("regenerateCode", { id: selected }, () => loadDetail(selected))} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">🔑 رمز جديد</ConfirmButton>
                    <ConfirmButton message="حذف كل الإجابات والمحاولات والشهادة؟" onConfirm={() => act("resetProgress", { id: selected }, () => loadDetail(selected))} className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">♻️ إعادة التعيين</ConfirmButton>
                    <ConfirmButton message="حذف الطالب نهائيًا؟" onConfirm={() => { void act("deleteStudent", { id: selected }); setSelected(null); }} className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white">🗑️ حذف الطالب</ConfirmButton>
                  </div></div>
                </section>
                <section className={card}><h2 className="mb-3 text-lg font-black text-turq-900">إجابات أنشطة المحطات</h2>
                  {detail.answers.filter((a) => a.attemptId === 0 && a.questionId === null).length === 0 ? <p className="text-sm text-slate-500">لا توجد إجابات بعد.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className="p-2 text-start">المحطة</th><th className="p-2 text-start">النشاط</th><th className="p-2 text-start">الإجابة</th><th className="p-2">النتيجة</th></tr></thead><tbody>
                    {detail.answers.filter((a) => a.attemptId === 0 && a.questionId === null).map((a) => <tr key={a.id} className="border-t align-top"><td className="p-2">{slideTitle(a.slideKey)}</td><td className="p-2 font-bold">{ACTIVITIES[a.activityKey]?.title ?? a.activityKey}</td><td className="max-w-md p-2">{humanizeActivityAnswer(a.answer)}</td><td className="p-2 text-center">{a.score}/{a.maxScore}</td></tr>)}
                  </tbody></table></div>}
                </section>
                <section className={card}><h2 className="mb-3 text-lg font-black text-turq-900">نشاط الكتاب والتقويم: الإجابات والتصحيح</h2>
                  <div className="space-y-2">{detail.answers.filter((a) => a.questionId !== null).map((a) => {
                    const q = detail.questions.find((x) => x.id === a.questionId);
                    return <div key={a.id} className="rounded-2xl border border-slate-200 p-3 text-sm"><p className="text-xs font-bold text-slate-500">{a.attemptId ? `محاولة الاختبار ${a.attemptId}` : "نشاط الكتاب"} — {q ? KIND_LABELS[q.kind] : ""}</p><p className="font-bold">{q?.prompt ?? `سؤال #${a.questionId}`}</p><p className="mt-1 rounded-xl bg-slate-50 p-2">{q ? humanizeResponse(q.kind, q.options, a.answer) : "—"}</p><p className={a.needsReview ? "text-amber-700" : a.isCorrect ? "text-emerald-700" : "text-rose-700"}>{a.needsReview ? (a.teacherScore === null ? "⏳ بانتظار التصحيح" : `✓ صُحح: ${a.teacherScore}/${a.maxScore}`) : `${a.isCorrect ? "✓ صحيحة" : "✗ غير صحيحة"} (${a.score}/${a.maxScore})`}</p>{q && typeof q.answer.modelAnswer === "string" && a.needsReview && <p className="text-xs text-slate-500">الإجابة النموذجية: {q.answer.modelAnswer}</p>}{a.teacherFeedback && <p className="text-xs text-slate-600">ملاحظة المعلم: {a.teacherFeedback}</p>}{a.needsReview && <GradeForm answer={a} act={act} refresh={() => loadDetail(selected)} />}</div>;
                  })}</div>
                </section>
                <section className={card}><h2 className="mb-3 text-lg font-black text-turq-900">محاولات الاختبار</h2>
                  {detail.attempts.length === 0 ? <p className="text-sm text-slate-500">لم يؤدِّ الاختبار بعد.</p> : detail.attempts.map((at) => <div key={at.id} className="mb-3 rounded-2xl border-2 p-3"><div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-turq-600 px-3 py-1 font-black text-white">المحاولة {at.attemptNumber}</span><span className="text-2xl font-black text-turq-900">{Math.round(at.percent)}%</span><span className="text-sm">آلي {at.autoScore}/{at.maxAutoScore} — كتابي {at.teacherScore}/{at.maxTeacherScore}</span>{at.pendingReview && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">بانتظار التصحيح</span>}</div><div className="mt-2 flex flex-wrap gap-2 text-xs">{Object.entries(at.skillReport).map(([k, v]) => <span key={k} className={cx("rounded-full px-2 py-0.5 font-bold", v.max && v.earned / v.max >= 0.6 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700")}>{k}: {v.earned}/{v.max}</span>)}</div></div>)}
                </section>
                <section className={card}><h2 className="mb-3 text-lg font-black text-turq-900">التسجيلات الصوتية ({detail.audios.length})</h2>
                  {detail.audios.length === 0 ? <p className="text-sm text-slate-500">لا توجد تسجيلات.</p> : <ul className="grid gap-2 md:grid-cols-2">{detail.audios.map((r) => <li key={r.id} className="rounded-2xl bg-slate-50 p-3"><p className="text-sm font-bold">{slideTitle(r.slideKey)} — {ACTIVITIES[r.title]?.title ?? r.title}</p><TeacherAudio id={r.id} /><p className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString("ar-SA")}</p></li>)}</ul>}
                </section>
              </>
            )}
          </div>
        )}

        {/* ---------------- الأسئلة ---------------- */}
        {tab === "questions" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-black text-turq-900">الأسئلة والأنشطة</h1><p className="text-slate-500">التعديلات تظهر للطلاب فورًا. تعطيل السؤال يخفيه دون حذف الإجابات السابقة.</p></div><Btn variant="warning" onClick={() => setEditing(editing === "new" ? null : "new")}>➕ إضافة سؤال</Btn></div>
            {editing === "new" && <section className={card}><QuestionEditor question={null} onSave={async (q) => { const ok = await act("saveQuestion", { question: q }); if (ok) setEditing(null); return ok; }} onClose={() => setEditing(null)} /></section>}
            {[{ key: "quiz", title: "التقويم الختامي (المحطة 11)" }, { key: "book", title: "نشاط الكتاب المدرسي (المحطة 10)" }].map((g) => <section key={g.key} className={card}><h2 className="mb-3 text-lg font-black text-turq-900">{g.title} ({questions.filter((q) => q.slideKey === g.key && q.active).length} مفعّل)</h2><div className="space-y-2">{questions.filter((q) => q.slideKey === g.key).map((q) => <div key={q.id} className={cx("rounded-2xl border-2 p-3", q.active ? "border-slate-200" : "border-dashed border-slate-300 opacity-70")}><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-turq-100 px-2 py-0.5 text-xs font-bold text-turq-800">{KIND_LABELS[q.kind] ?? q.kind}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold">{q.skill}</span><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold">{q.points} د</span>{!q.active && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">معطّل</span>}<p className="w-full font-bold text-slate-800 md:w-auto md:flex-1">{q.prompt}</p><button onClick={() => setEditing(editing === q.id ? null : q.id)} className="rounded-xl bg-turq-50 px-3 py-1 text-sm font-bold text-turq-700">{editing === q.id ? "إغلاق" : "✏️ تعديل"}</button><button onClick={() => act("toggleQuestion", { id: q.id })} className="rounded-xl bg-slate-100 px-3 py-1 text-sm font-bold">{q.active ? "تعطيل" : "تفعيل"}</button></div>{editing === q.id && <div className="mt-3"><QuestionEditor question={q} onSave={async (v) => { const ok = await act("saveQuestion", { question: v }); if (ok) setEditing(null); return ok; }} onClose={() => setEditing(null)} /></div>}</div>)}</div></section>)}
            <section className={card}><h2 className="mb-3 text-lg font-black text-turq-900">أنشطة المحطات التفاعلية</h2><div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">{Object.entries(ACTIVITIES).map(([k, a]) => <div key={k} className="rounded-2xl border p-3 text-sm"><p className="text-xs font-bold text-turq-700">{slideTitle(a.slideKey)}</p><p className="font-bold">{a.title}</p><p className="text-xs text-slate-500">{a.kind} — {a.maxScore} درجة — {a.required ? "إلزامي" : "اختياري"}</p></div>)}</div></section>
          </div>
        )}

        {/* ---------------- الوسائط المشتركة ---------------- */}
        {tab === "media" && <MediaManager media={data.media ?? []} onChange={loadData} />}

        {/* ---------------- السبورة ---------------- */}
        {tab === "board" && <LiveQuizBoard />}

        {/* ---------------- الإعدادات ---------------- */}
        {tab === "settings" && (
          <div className="space-y-6">
            <h1 className="text-3xl font-black text-turq-900">الإعدادات</h1>
            <ActivityRulesSettings allowSkip={settings.allowSkip} activityRules={settings.activityRules} busy={busy} onSave={(rules, allowSkip) => act("updateActivityRules", { rules, allowSkip })} />
            <div className="grid gap-6 lg:grid-cols-2">
              <section className={card}><h2 className="mb-3 text-lg font-black text-turq-900">إعدادات الاختبار</h2>
                <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act("updateSettings", { passPercent: Number(f.get("passPercent")), maxAttempts: Number(f.get("maxAttempts")), videoUrl: String(f.get("videoUrl") ?? ""), allowAudio: f.get("allowAudio") === "on", soundsEnabled: f.get("soundsEnabled") === "on" }); }} className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">نسبة النجاح (%)<input name="passPercent" type="number" min={50} max={100} defaultValue={settings.passPercent} className={input} /></label><label className="text-sm font-bold">عدد المحاولات<input name="maxAttempts" type="number" min={1} max={10} defaultValue={settings.maxAttempts} className={input} /></label></div><label className="block text-sm font-bold">رابط فيديو محطة الطهارة<input name="videoUrl" type="url" defaultValue={settings.videoUrl ?? ""} placeholder="https://www.youtube.com/watch?v=…" className={input} /></label><div className="flex flex-wrap gap-5"><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="allowAudio" defaultChecked={settings.allowAudio} className="h-5 w-5" /> التسجيل الصوتي</label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="soundsEnabled" defaultChecked={settings.soundsEnabled} className="h-5 w-5" /> أصوات التعزيز</label></div><button className="rounded-xl bg-turq-600 px-5 py-2 font-bold text-white">💾 حفظ</button></form>
              </section>
              <section className={card}><h2 className="mb-3 text-lg font-black text-turq-900">تغيير كلمة المرور</h2>
                <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act("changePassword", { current: String(f.get("current") ?? ""), next: String(f.get("next") ?? "") }); e.currentTarget.reset(); }} className="space-y-3"><label className="block text-sm font-bold">كلمة المرور الحالية<input name="current" type="password" required className={input} /></label><label className="block text-sm font-bold">كلمة المرور الجديدة<input name="next" type="password" required minLength={6} className={input} /></label><button className="rounded-xl bg-slate-800 px-5 py-2 font-bold text-white">تغيير</button></form>
                <div className="mt-5 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600"><p className="font-bold">حالة النظام</p><p>قاعدة البيانات متصلة ✅</p><p>جلسة المعلم محمية وتعمل دون الاعتماد على الكوكيز.</p></div>
              </section>
            </div>
            <section className={card}><h2 className="mb-3 text-lg font-black text-turq-900">عناوين المحطات وروابط الفيديو</h2><div className="space-y-2">{slides.map((sl, i) => <form key={sl.id} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act("updateSlide", { id: sl.id, title: String(f.get("title") ?? ""), subtitle: String(f.get("subtitle") ?? ""), videoUrl: String(f.get("videoUrl") ?? "") }); }} className="grid items-center gap-2 rounded-2xl bg-slate-50 p-2 md:grid-cols-[40px_1fr_1fr_1.4fr_auto]"><span className="grid h-9 w-9 place-items-center rounded-full bg-turq-600 text-sm font-black text-white">{i + 1}</span><input name="title" defaultValue={sl.title} required className={input} /><input name="subtitle" defaultValue={sl.subtitle} className={input} /><input name="videoUrl" type="url" defaultValue={sl.videoUrl ?? ""} placeholder="رابط فيديو (اختياري)" className={input} /><button className="rounded-xl bg-turq-600 px-3 py-2 text-sm font-bold text-white">حفظ</button></form>)}</div></section>
            <section className={card}><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="mb-1 text-lg font-black text-turq-900">🖼️ الصور و🎧 المقاطع الصوتية</h2><p className="text-sm text-slate-500">أصبحت الإدارة في تبويب مستقل، والمقاطع تظهر فعليًا للطلاب في المحطات. التعديلات مشتركة لجميع الأجهزة.</p></div><Btn onClick={() => setTab("media")}>فتح إدارة الصور والصوتيات ←</Btn></div></section>
          </div>
        )}
      </main>
      {busy && <div className="fixed bottom-4 left-4 z-50 rounded-2xl bg-turq-700 px-4 py-2 text-sm font-bold text-white shadow-xl">جارٍ الحفظ…</div>}
    </div>
  );
}

/** نموذج تصحيح الإجابة الكتابية (مستخدم داخل صفحة الطالب) */
function GradeForm({ answer, act, refresh }: { answer: AnswerRow | null; act: (action: string, p: Record<string, unknown>, after?: () => Promise<void>) => Promise<boolean>; refresh: () => Promise<void> }) {
  if (!answer) return null;
  return (
    <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await act("gradeAnswer", { answerId: answer.id, score: Number(f.get("score")), feedback: String(f.get("feedback") ?? "") }, refresh); }} className="mt-2 flex flex-wrap items-end gap-2 rounded-xl bg-amber-50 p-2">
      <label className="text-xs font-bold">الدرجة (من {answer.maxScore})<input name="score" type="number" min={0} max={answer.maxScore} defaultValue={answer.teacherScore ?? answer.maxScore} className="block w-24 rounded-xl border-2 border-slate-200 p-2" /></label>
      <label className="flex-1 text-xs font-bold">ملاحظة<input name="feedback" defaultValue={answer.teacherFeedback ?? ""} placeholder="أحسنت…" className="block w-full rounded-xl border-2 border-slate-200 p-2" /></label>
      <button className="rounded-xl bg-turq-600 px-4 py-2 text-sm font-bold text-white">{answer.teacherScore === null ? "اعتماد التصحيح" : "تحديث"}</button>
    </form>
  );
}
