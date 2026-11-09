"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AGE_QUESTION,
  BRAINSTORM_CHIPS,
  CONDITIONS,
  DISCOVER_MEANINGS,
  EVIDENCE,
  TAHARA_QUESTIONS,
  THREE_SITUATIONS,
  type ActivityResult,
} from "@/lib/content";
import type { JourneyCtx } from "./Journey";
import { AudioRecorder, Btn, Card, Choices, Feedback, FlipCard, MatchPairs, ScoreBadge, StationShell, VideoPlayer, cx, shuffle } from "./ui";

export type StationProps = { ctx: JourneyCtx; title: string; subtitle: string };

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export function EvidenceCard({ intro, text, source, quran }: { intro: string; text: string; source: string; quran?: boolean }) {
  return (
    <div className="rounded-3xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-inner">
      <p className="text-sm font-bold text-amber-800">{intro}</p>
      <p className={cx("my-2 text-2xl font-bold leading-loose text-turq-900", quran && "quran text-3xl text-emerald-900")}>{text}</p>
      <p className="text-xs font-bold text-slate-500">{source}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  المحطة 1: التهيئة                                                   */
/* ------------------------------------------------------------------ */

const INTRO_SCENES = [
  { emoji: "😴", text: "استيقظ سالم من النوم وسمع الأذان، فأراد أن يصلي فورًا." },
  { emoji: "👕", text: "لاحظت نورة بقعة على ثوبها وهي تستعد للصلاة." },
  { emoji: "🩳", text: "أراد سليمان أن يصلي وكان يلبس سروالًا قصيرًا فوق الركبة." },
];

export function StationIntro({ ctx, title, subtitle }: StationProps) {
  const saved = ctx.state.answers.intro_predict;
  const savedOpen = ctx.state.answers.intro_brainstorm;
  const [chips, setChips] = useState<string[]>(() => (Array.isArray(rec(saved?.answer).choices) ? (rec(saved?.answer).choices as string[]) : []));
  const [text, setText] = useState<string>(() => (typeof rec(savedOpen?.answer).text === "string" ? (rec(savedOpen?.answer).text as string) : ""));
  const [sent, setSent] = useState(!!saved);
  const [openSent, setOpenSent] = useState(!!savedOpen);
  const question = "ما الأشياء التي يجب التأكد منها قبل الصلاة؟";

  const submit = async () => {
    const r = await ctx.saveAnswer("intro_predict", { choices: chips });
    if (r) {
      setSent(true);
      ctx.sounds.success();
    }
  };
  const submitText = async () => {
    if (!text.trim()) return;
    const r = await ctx.saveAnswer("intro_brainstorm", { text: text.trim() });
    if (r) {
      setOpenSent(true);
      ctx.sounds.success();
    }
  };

  return (
    <StationShell emoji="🤔" title={title} subtitle={subtitle} strategy="العصف الذهني وأسئلة التوقع" onSpeak={() => ctx.speak(`${title}. ${question}`)}>
      <Card className="overflow-hidden bg-gradient-to-l from-turq-50 to-white">
        <div className="grid items-center gap-6 md:grid-cols-[220px_1fr]">
          <div className="relative mx-auto h-56 w-56 animate-float">
            <Image src="/images/hero-boy.png" alt="طالب يستعد للصلاة" fill className="object-contain drop-shadow-xl" priority />
          </div>
          <div>
            <p className="text-lg leading-relaxed text-slate-700">
              مرحبًا يا بطل! أنا <span className="font-black text-turq-700">سالم</span>، أستعد الآن للصلاة… لكن قبل أن أبدأ، هل تساعدني؟
            </p>
            <p className="mt-3 rounded-2xl bg-white p-4 text-2xl font-black text-turq-900 shadow-sm">{question}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {INTRO_SCENES.map((s, i) => (
          <Card key={i} className="text-center">
            <div className="mb-2 text-6xl">{s.emoji}</div>
            <p className="font-semibold leading-relaxed text-slate-700">{s.text}</p>
            <p className="mt-2 text-sm font-bold text-brand-orange">ماذا تتوقع؟ هل صلاته صحيحة؟</p>
          </Card>
        ))}
      </div>

      <Card>
        <h3 className="mb-1 text-xl font-black text-turq-900">🧠 عصف ذهني: اختر ما تتوقع أنه مهم قبل الصلاة</h3>
        <p className="mb-4 text-sm text-slate-500">لا توجد إجابة خاطئة الآن؛ المهم أن تشارك وتفكر!</p>
        <div className="flex flex-wrap gap-2">
          {BRAINSTORM_CHIPS.map((c) => {
            const on = chips.includes(c);
            return (
              <button
                key={c}
                type="button"
                disabled={sent}
                onClick={() => {
                  ctx.sounds.click();
                  setChips(on ? chips.filter((x) => x !== c) : [...chips, c]);
                }}
                className={cx(
                  "touch-target rounded-2xl border-2 px-4 py-2 text-lg font-bold transition-all",
                  on ? "border-turq-500 bg-turq-500 text-white shadow" : "border-slate-200 bg-white hover:border-turq-300",
                  sent && "opacity-80",
                )}
              >
                {c}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!sent ? (
            <Btn onClick={submit} disabled={chips.length === 0 || ctx.busy} size="lg">
              أرسل توقعي ✨
            </Btn>
          ) : (
            <Feedback kind="correct">
              رائع يا {ctx.state.student.name}! شاركت بتوقعك وحصلت على نقاط المشاركة. سنكتشف معًا في المحطات القادمة أن للصلاة شروطًا ستة، فلنبدأ الرحلة!
            </Feedback>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-xl font-black text-turq-900">✍️ اكتب أو سجّل إجابتك بصوتك (اختياري)</h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          disabled={openSent}
          placeholder="قبل الصلاة أتأكد من…"
          className="w-full rounded-2xl border-2 border-slate-200 p-4 text-lg focus:border-turq-400 focus:outline-none disabled:bg-slate-50"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Btn variant="secondary" onClick={submitText} disabled={!text.trim() || openSent || ctx.busy}>
            {openSent ? "✓ تم حفظ إجابتك" : "حفظ الإجابة الكتابية"}
          </Btn>
          {ctx.state.settings.allowAudio && (
            <AudioRecorder
              saved={ctx.state.audioSlides.includes("intro")}
              onSave={(d) => ctx.uploadAudio("intro", "intro_brainstorm", d)}
            />
          )}
        </div>
      </Card>
    </StationShell>
  );
}

/* ------------------------------------------------------------------ */
/*  المحطة 2: الاكتشاف                                                   */
/* ------------------------------------------------------------------ */

export function StationDiscover({ ctx, title, subtitle }: StationProps) {
  const savedMatch = ctx.state.answers.discover_match;
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set(ctx.state.answers.discover_flip ? CONDITIONS.map((c) => c.key) : []));
  const [pairs, setPairs] = useState<Record<string, string>>(() => (savedMatch ? (savedMatch.answer as Record<string, string>) : {}));
  const [result, setResult] = useState<ActivityResult | null>(
    savedMatch ? { isCorrect: savedMatch.isCorrect, score: savedMatch.score, maxScore: savedMatch.maxScore, needsReview: false, detail: savedMatch.detail } : null,
  );
  const meanings = useMemo(() => shuffle(CONDITIONS.map((c) => ({ id: c.key, label: DISCOVER_MEANINGS[c.key] }))), []);
  const allFlipped = flipped.size === CONDITIONS.length;

  useEffect(() => {
    if (allFlipped && !ctx.state.answers.discover_flip) ctx.saveAnswer("discover_flip", { done: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFlipped]);

  const check = async () => {
    const r = await ctx.saveAnswer("discover_match", pairs);
    if (r) {
      setResult(r);
      if (r.isCorrect) {
        ctx.sounds.success();
        ctx.celebrate();
      } else ctx.sounds.error();
    }
  };
  const retry = () => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(pairs)) if (result?.detail?.[k]) next[k] = v;
    setPairs(next);
    setResult(null);
  };

  return (
    <StationShell emoji="🃏" title={title} subtitle={subtitle} strategy="التعلم بالاكتشاف" onSpeak={() => ctx.speak("اضغط على كل بطاقة لتكتشف شرطًا من شروط الصلاة الستة")}>
      <Card className="bg-gradient-to-l from-sky-50 to-white">
        <p className="text-lg font-semibold text-slate-700">
          أمامك ست بطاقات سرية 🔒 اضغط على كل بطاقة لتقلبها وتكتشف شرطًا من شروط الصلاة، واستمع إلى الشرح بالضغط على 🔊.
        </p>
        <p className="mt-2 text-sm font-bold text-turq-700">
          اكتشفت {flipped.size} من {CONDITIONS.length}
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONDITIONS.map((c) => (
          <FlipCard
            key={c.key}
            flipped={flipped.has(c.key)}
            onFlip={() => {
              ctx.sounds.click();
              setFlipped((s) => new Set(s).add(c.key));
            }}
            front={
              <div className={cx("flex h-full flex-col items-center justify-center rounded-3xl bg-gradient-to-br p-4 text-white shadow-lg", c.color)}>
                <span className="text-6xl">❔</span>
                <span className="mt-3 text-xl font-black">الشرط {c.ordinal}</span>
                <span className="mt-1 text-sm opacity-90">اضغط للاكتشاف</span>
              </div>
            }
            back={
              <div className="flex h-full flex-col rounded-3xl border-4 border-turq-200 bg-white p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-4xl">{c.icon}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      ctx.speak(`الشرط ${c.ordinal}: ${c.name}. ${c.text}`);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && ctx.speak(`الشرط ${c.ordinal}: ${c.name}. ${c.text}`)}
                    className="touch-target grid place-items-center rounded-2xl bg-turq-50 text-2xl text-turq-700 hover:bg-turq-100"
                    aria-label="استمع إلى الشرح"
                  >
                    🔊
                  </span>
                </div>
                <h4 className="mt-2 text-2xl font-black text-turq-900">{c.name}</h4>
                <p className="mt-1 text-base font-semibold leading-relaxed text-slate-700">{c.text}</p>
                <p className="mt-auto rounded-xl bg-orange-50 p-2 text-sm text-orange-800">مثال: {c.example}</p>
              </div>
            }
          />
        ))}
      </div>

      <Card className={cx(!allFlipped && "opacity-60")}>
        <h3 className="mb-1 text-xl font-black text-turq-900">🔗 نشاط المطابقة: صل كل شرط بمعناه</h3>
        <p className="mb-4 text-sm text-slate-500">{allFlipped ? "اضغط على الشرط ثم اضغط على المعنى المناسب له." : "اكتشف جميع البطاقات أولًا لفتح نشاط المطابقة."}</p>
        <MatchPairs
          left={CONDITIONS.map((c) => ({ id: c.key, label: c.name, emoji: c.icon }))}
          right={meanings}
          value={pairs}
          onChange={setPairs}
          results={result?.detail}
          disabled={!allFlipped || !!result}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!result ? (
            <Btn size="lg" onClick={check} disabled={!allFlipped || Object.keys(pairs).length < CONDITIONS.length || ctx.busy}>
              تحقق من إجاباتي ✅
            </Btn>
          ) : (
            <>
              <ScoreBadge score={result.score} max={result.maxScore} />
              {result.isCorrect ? (
                <Feedback kind="correct">ممتاز! طابقت الشروط الستة بمعانيها بشكل صحيح.</Feedback>
              ) : (
                <>
                  <Feedback kind="wrong">أحسنت المحاولة! راجع البطاقات ذات العلامة ✗ ثم حاول مرة أخرى.</Feedback>
                  <Btn variant="warning" onClick={retry}>
                    🔁 حاول مرة أخرى
                  </Btn>
                </>
              )}
            </>
          )}
        </div>
      </Card>
    </StationShell>
  );
}

/* ------------------------------------------------------------------ */
/*  المحطة 3: الإسلام والتمييز والعقل                                    */
/* ------------------------------------------------------------------ */

export function StationThree({ ctx, title, subtitle }: StationProps) {
  const savedSit = ctx.state.answers.three_situations;
  const savedAge = ctx.state.answers.three_age;
  const [sit, setSit] = useState<Record<string, number>>(() => (savedSit ? (savedSit.answer as Record<string, number>) : {}));
  const [sitResult, setSitResult] = useState<ActivityResult | null>(savedSit ? { ...savedSit, needsReview: false } : null);
  const [age, setAge] = useState<number | null>(() => (savedAge ? Number(rec(savedAge.answer).choice) : null));
  const [ageResult, setAgeResult] = useState<ActivityResult | null>(savedAge ? { ...savedAge, needsReview: false } : null);

  const checkSit = async () => {
    const r = await ctx.saveAnswer("three_situations", sit);
    if (r) {
      setSitResult(r);
      r.isCorrect ? ctx.sounds.success() : ctx.sounds.error();
    }
  };
  const checkAge = async (i: number) => {
    setAge(i);
    const r = await ctx.saveAnswer("three_age", { choice: i });
    if (r) {
      setAgeResult(r);
      if (r.isCorrect) {
        ctx.sounds.success();
        ctx.celebrate();
      } else ctx.sounds.error();
    }
  };

  return (
    <StationShell emoji="🧒" title={title} subtitle={subtitle} strategy="التعلم بالمواقف" onSpeak={() => ctx.speak("اقرأ كل موقف واختر الإجابة المناسبة")}>
      <div className="grid gap-4 md:grid-cols-3">
        {CONDITIONS.slice(0, 3).map((c) => (
          <Card key={c.key} className={cx("bg-gradient-to-br text-white", c.color)}>
            <div className="text-4xl">{c.icon}</div>
            <h3 className="mt-2 text-xl font-black">
              الشرط {c.ordinal}: {c.name}
            </h3>
            <p className="mt-1 font-semibold leading-relaxed">{c.text}</p>
          </Card>
        ))}
      </div>

      <EvidenceCard intro={EVIDENCE.hadithRafa.intro} text={EVIDENCE.hadithRafa.text} source={EVIDENCE.hadithRafa.source} />

      <Card>
        <h3 className="mb-4 text-xl font-black text-turq-900">🎭 مواقف من حياتنا</h3>
        <div className="space-y-5">
          {THREE_SITUATIONS.map((s) => (
            <div key={s.key} className="rounded-2xl bg-slate-50 p-4">
              <p className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-800">
                <span className="text-3xl">{s.emoji}</span>
                {s.text}
              </p>
              <Choices
                choices={s.choices}
                value={sit[s.key]}
                onChange={(i) => setSit({ ...sit, [s.key]: i })}
                revealed={!!sitResult}
                correct={s.correct}
                disabled={!!sitResult}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!sitResult ? (
            <Btn size="lg" onClick={checkSit} disabled={Object.keys(sit).length < THREE_SITUATIONS.length || ctx.busy}>
              تحقق ✅
            </Btn>
          ) : (
            <>
              <ScoreBadge score={sitResult.score} max={sitResult.maxScore} />
              <Feedback kind={sitResult.isCorrect ? "correct" : "info"}>
                {sitResult.isCorrect ? "أحسنت! فهمت الشروط الثلاثة الأولى." : "لاحظ الإجابات الصحيحة باللون الأخضر وتذكرها جيدًا."}
              </Feedback>
              {!sitResult.isCorrect && (
                <Btn variant="warning" onClick={() => setSitResult(null)}>
                  🔁 حاول مرة أخرى
                </Btn>
              )}
            </>
          )}
        </div>
      </Card>

      <Card className="border-4 border-brand-orange/30">
        <h3 className="mb-3 text-2xl font-black text-turq-900">⏳ {AGE_QUESTION.text}</h3>
        <Choices choices={AGE_QUESTION.choices} value={age} onChange={checkAge} revealed={!!ageResult} correct={AGE_QUESTION.correct} disabled={!!ageResult} columns={3} />
        {ageResult && (
          <div className="mt-4 space-y-3">
            <Feedback kind={ageResult.isCorrect ? "correct" : "wrong"}>
              {ageResult.isCorrect ? "صحيح! سن التمييز سبع سنين." : "الإجابة الصحيحة: 7 سنوات."}
            </Feedback>
            <Feedback kind="info">{AGE_QUESTION.feedback}</Feedback>
            {!ageResult.isCorrect && (
              <Btn
                variant="warning"
                onClick={() => {
                  setAgeResult(null);
                  setAge(null);
                }}
              >
                🔁 حاول مرة أخرى
              </Btn>
            )}
          </div>
        )}
      </Card>
    </StationShell>
  );
}

/* ------------------------------------------------------------------ */
/*  المحطة 4: الطهارة                                                    */
/* ------------------------------------------------------------------ */

export function StationTahara({ ctx, title, subtitle, videoUrl }: StationProps & { videoUrl: string | null }) {
  const saved = ctx.state.answers.tahara_quiz;
  const [phase, setPhase] = useState<"intro" | "video" | "activity">(saved ? "activity" : "intro");
  const [ans, setAns] = useState<Record<string, number>>(() => (saved ? (saved.answer as Record<string, number>) : {}));
  const [result, setResult] = useState<ActivityResult | null>(saved ? { ...saved, needsReview: false } : null);

  const check = async () => {
    const r = await ctx.saveAnswer("tahara_quiz", ans);
    if (r) {
      setResult(r);
      if (r.isCorrect) {
        ctx.sounds.success();
        ctx.celebrate();
      } else ctx.sounds.error();
    }
  };

  return (
    <StationShell emoji="💧" title={title} subtitle={subtitle} strategy="شاهد – فكر – أجب" onSpeak={() => ctx.speak(`الشرط الرابع: الطهارة. ${EVIDENCE.hadithTahara.text}`)}>
      <Card className="bg-gradient-to-l from-cyan-50 to-white">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-24 w-24 place-items-center rounded-3xl bg-cyan-100 text-6xl">🚰</div>
          <div className="flex-1">
            <h3 className="text-2xl font-black text-turq-900">الشرط الرابع: الطهارة</h3>
            <p className="mt-1 text-lg text-slate-700">المسلم يستعد للصلاة بالطهارة؛ فمن أحدث لا تُقبل صلاته حتى يتوضأ.</p>
          </div>
        </div>
      </Card>

      <EvidenceCard intro={EVIDENCE.hadithTahara.intro} text={EVIDENCE.hadithTahara.text} source={EVIDENCE.hadithTahara.source} />

      {phase === "intro" && (
        <Card className="text-center">
          {videoUrl ? (
            <>
              <h3 className="text-xl font-black text-turq-900">🎬 شاهد الفيديو التعليمي القصير عن الاستعداد للصلاة والطهارة</h3>
              <p className="mt-2 text-slate-600">بعد انتهاء الفيديو سينتقل بك النشاط تلقائيًا إلى مرحلة «فكر وأجب».</p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Btn size="lg" onClick={() => setPhase("video")}>
                  ▶️ تشغيل الفيديو
                </Btn>
                <Btn variant="secondary" onClick={() => setPhase("activity")}>
                  الانتقال إلى النشاط مباشرة
                </Btn>
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto mb-3 grid h-40 w-full max-w-md place-items-center rounded-3xl bg-gradient-to-br from-sky-100 to-cyan-50 text-7xl">
                🧼💧🤲
              </div>
              <p className="text-lg font-semibold text-slate-700">لم يُضف المعلم رابط فيديو لهذه المحطة بعد (يمكن إضافته من لوحة المعلم).</p>
              <Btn className="mt-4" size="lg" onClick={() => setPhase("activity")}>
                فكّر وأجب ←
              </Btn>
            </>
          )}
        </Card>
      )}

      {phase === "video" && videoUrl && (
        <Card>
          <VideoPlayer url={videoUrl} onEnded={() => setPhase("activity")} />
          <div className="mt-3 flex justify-between">
            <p className="text-sm text-slate-500">سينتقل النشاط تلقائيًا عند انتهاء الفيديو.</p>
            <Btn variant="secondary" size="sm" onClick={() => setPhase("activity")}>
              تخطي إلى النشاط ←
            </Btn>
          </div>
        </Card>
      )}

      {phase === "activity" && (
        <Card className="animate-fadeup">
          <h3 className="mb-4 text-xl font-black text-turq-900">🤔 فكر وأجب</h3>
          <div className="space-y-5">
            {TAHARA_QUESTIONS.map((q, i) => (
              <div key={q.key} className="rounded-2xl bg-slate-50 p-4">
                <p className="mb-3 text-lg font-bold text-slate-800">
                  {i + 1}. {q.text}
                </p>
                <Choices choices={q.choices} value={ans[q.key]} onChange={(v) => setAns({ ...ans, [q.key]: v })} revealed={!!result} correct={q.correct} disabled={!!result} />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {!result ? (
              <Btn size="lg" onClick={check} disabled={Object.keys(ans).length < TAHARA_QUESTIONS.length || ctx.busy}>
                تحقق ✅
              </Btn>
            ) : (
              <>
                <ScoreBadge score={result.score} max={result.maxScore} />
                <Feedback kind={result.isCorrect ? "correct" : "info"}>
                  {result.isCorrect
                    ? "رائع! استنتجت أن الطهارة شرط لقبول الصلاة كما دل عليه الحديث."
                    : "تذكر: «لا يقبل الله صلاة أحدكم إذا أحدث حتى يتوضأ»؛ فالطهارة هي الشرط الرابع."}
                </Feedback>
                {!result.isCorrect && (
                  <Btn variant="warning" onClick={() => setResult(null)}>
                    🔁 حاول مرة أخرى
                  </Btn>
                )}
              </>
            )}
          </div>
        </Card>
      )}
    </StationShell>
  );
}
