"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  AWRAH,
  AWRAH_RULE_CHOICES,
  AYAH_RELATION,
  DETECTIVE_CASES,
  EVIDENCE,
  NAJASA_CARDS,
  NAJASA_PLACES,
  OUTFITS,
  SULAIMAN_STORY,
  type ActivityResult,
} from "@/lib/content";
import type { StationProps } from "./StationsA";
import { EvidenceCard } from "./StationsA";
import { AudioRecorder, Btn, Card, Choices, DragZones, Feedback, OrderWords, ScoreBadge, StationShell, Stars, cx, shuffle } from "./ui";

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/* ------------------------------------------------------------------ */
/*  المحطة 5: إزالة النجاسة                                              */
/* ------------------------------------------------------------------ */

export function StationNajasa({ ctx, title, subtitle }: StationProps) {
  const saved = ctx.state.answers.najasa_dragdrop;
  const [map, setMap] = useState<Record<string, string>>(() => (saved ? (saved.answer as Record<string, string>) : {}));
  const [result, setResult] = useState<ActivityResult | null>(saved ? { ...saved, needsReview: false } : null);
  const cards = useMemo(() => shuffle(NAJASA_CARDS), []);

  const check = async () => {
    const r = await ctx.saveAnswer("najasa_dragdrop", map);
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
    for (const [k, v] of Object.entries(map)) if (result?.detail?.[k]) next[k] = v;
    setMap(next);
    setResult(null);
  };

  return (
    <StationShell emoji="🧼" title={title} subtitle={subtitle} strategy="السحب والإفلات" onSpeak={() => ctx.speak("عند إرادة الصلاة تجب إزالة النجاسة عن ثلاثة أشياء: البدن، والملابس، ومكان الصلاة")}>
      <Card className="bg-gradient-to-l from-emerald-50 to-white">
        <h3 className="text-2xl font-black text-turq-900">الشرط الخامس: إزالة النجاسة</h3>
        <p className="mt-2 text-lg font-semibold text-slate-700">عند إرادة الصلاة تجب إزالة النجاسة عن ثلاثة أشياء هي:</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {NAJASA_PLACES.map((p, i) => (
            <div key={p.key} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500 font-black text-white">{i + 1}</span>
              <span className="text-3xl">{p.icon}</span>
              <span className="text-xl font-black text-turq-900">{p.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-xl font-black text-turq-900">🎯 اسحب كل بطاقة إلى المكان الذي يجب إزالة النجاسة عنه</h3>
        <p className="mb-4 text-sm text-slate-500">يمكنك أيضًا الضغط على البطاقة ثم الضغط على المنطقة المناسبة (مناسب للمس والسبورة الذكية).</p>
        <DragZones
          items={cards.map((c) => ({ id: c.id, label: c.label, emoji: c.emoji }))}
          zones={NAJASA_PLACES.map((p) => ({ id: p.key, label: p.label, emoji: p.icon }))}
          value={map}
          onChange={setMap}
          results={result?.detail}
          disabled={!!result}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!result ? (
            <Btn size="lg" onClick={check} disabled={Object.keys(map).length < NAJASA_CARDS.length || ctx.busy}>
              تحقق ✅
            </Btn>
          ) : (
            <>
              <ScoreBadge score={result.score} max={result.maxScore} />
              {result.isCorrect ? (
                <Feedback kind="correct">ممتاز! عرفت المواضع الثلاثة: البدن، والملابس، ومكان الصلاة.</Feedback>
              ) : (
                <>
                  <Feedback kind="wrong">بعض البطاقات في غير مكانها (العلامة ✗). أعد المحاولة.</Feedback>
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
/*  المحطة 6: المحقق الصغير                                              */
/* ------------------------------------------------------------------ */

export function StationDetective({ ctx, title, subtitle }: StationProps) {
  const [answers, setAnswers] = useState<Record<string, { where?: number; fix?: number }>>(() => {
    const init: Record<string, { where?: number; fix?: number }> = {};
    for (const c of DETECTIVE_CASES) {
      const s = ctx.state.answers[c.key];
      if (s) init[c.key] = rec(s.answer) as { where?: number; fix?: number };
    }
    return init;
  });
  const [results, setResults] = useState<Record<string, ActivityResult | null>>(() => {
    const init: Record<string, ActivityResult | null> = {};
    for (const c of DETECTIVE_CASES) {
      const s = ctx.state.answers[c.key];
      init[c.key] = s ? { ...s, needsReview: false } : null;
    }
    return init;
  });
  const stars = DETECTIVE_CASES.filter((c) => results[c.key]?.isCorrect).length;

  const check = async (key: string) => {
    const r = await ctx.saveAnswer(key, answers[key] ?? {});
    if (r) {
      setResults((p) => ({ ...p, [key]: r }));
      if (r.isCorrect) {
        ctx.sounds.success();
        if (stars + 1 === DETECTIVE_CASES.length) ctx.celebrate();
      } else ctx.sounds.error();
    }
  };

  return (
    <StationShell emoji="🔍" title={title} subtitle={subtitle} strategy="المحقق الصغير" onSpeak={() => ctx.speak("أنت المحقق الصغير. اكتشف موضع المشكلة وطريقة معالجتها قبل الصلاة")}>
      <Card className="overflow-hidden bg-gradient-to-l from-orange-50 to-white">
        <div className="grid items-center gap-4 md:grid-cols-[180px_1fr]">
          <div className="relative mx-auto h-44 w-44 animate-float">
            <Image src="/images/detective-kid.png" alt="المحقق الصغير" fill priority className="object-contain drop-shadow-xl" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-turq-900">مهمتك أيها المحقق الصغير!</h3>
            <p className="mt-1 text-lg text-slate-700">في كل قضية: حدد أين توجد النجاسة (البدن / الملابس / مكان الصلاة)، ثم اختر طريقة معالجتها الصحيحة. كل قضية تحلها تمنحك نجمة ⭐</p>
            <div className="mt-3 flex items-center gap-3">
              <Stars count={stars} total={DETECTIVE_CASES.length} />
              <span className="font-bold text-orange-700">
                {stars} / {DETECTIVE_CASES.length}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {DETECTIVE_CASES.map((c) => {
        const a = answers[c.key] ?? {};
        const r = results[c.key];
        return (
          <Card key={c.key} className={cx("border-4", r?.isCorrect ? "border-emerald-300" : r ? "border-rose-200" : "border-transparent")}>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-4xl">{c.emoji}</span>
              <div>
                <h4 className="text-xl font-black text-turq-900">{c.title}</h4>
                <p className="text-lg text-slate-700">{c.text}</p>
              </div>
              {r?.isCorrect && <span className="ms-auto text-4xl">⭐</span>}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="mb-2 font-bold text-slate-700">🔎 أين المشكلة؟</p>
                <Choices choices={c.whereChoices} value={a.where} onChange={(i) => setAnswers({ ...answers, [c.key]: { ...a, where: i } })} revealed={!!r} correct={c.whereCorrect} disabled={!!r} />
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="mb-2 font-bold text-slate-700">🛠️ كيف أعالجها؟</p>
                <Choices choices={c.fixChoices} value={a.fix} onChange={(i) => setAnswers({ ...answers, [c.key]: { ...a, fix: i } })} revealed={!!r} correct={c.fixCorrect} disabled={!!r} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {!r ? (
                <Btn onClick={() => check(c.key)} disabled={a.where === undefined || a.fix === undefined || ctx.busy}>
                  حل القضية 🕵️
                </Btn>
              ) : r.isCorrect ? (
                <Feedback kind="correct">قضية محلولة! حصلت على نجمة.</Feedback>
              ) : (
                <>
                  <Feedback kind="wrong">لم تُحل القضية بعد؛ راجع الإجابات الخضراء ثم حاول من جديد.</Feedback>
                  <Btn variant="warning" onClick={() => setResults({ ...results, [c.key]: null })}>
                    🔁 إعادة التحقيق
                  </Btn>
                </>
              )}
            </div>
          </Card>
        );
      })}
    </StationShell>
  );
}

/* ------------------------------------------------------------------ */
/*  المحطة 7: ستر العورة                                                 */
/* ------------------------------------------------------------------ */

export function StationAwrah({ ctx, title, subtitle }: StationProps) {
  const savedRules = ctx.state.answers.awrah_rules;
  const savedOutfits = ctx.state.answers.awrah_outfits;
  const [rules, setRules] = useState<Record<string, number>>(() => (savedRules ? (savedRules.answer as Record<string, number>) : {}));
  const [rulesResult, setRulesResult] = useState<ActivityResult | null>(savedRules ? { ...savedRules, needsReview: false } : null);
  const [outfits, setOutfits] = useState<Record<string, number>>(() => (savedOutfits ? (savedOutfits.answer as Record<string, number>) : {}));
  const [outfitsResult, setOutfitsResult] = useState<ActivityResult | null>(savedOutfits ? { ...savedOutfits, needsReview: false } : null);
  const [storyOpen, setStoryOpen] = useState(false);

  const checkRules = async () => {
    const r = await ctx.saveAnswer("awrah_rules", rules);
    if (r) {
      setRulesResult(r);
      r.isCorrect ? ctx.sounds.success() : ctx.sounds.error();
    }
  };
  const checkOutfits = async () => {
    const r = await ctx.saveAnswer("awrah_outfits", outfits);
    if (r) {
      setOutfitsResult(r);
      if (r.isCorrect) {
        ctx.sounds.success();
        ctx.celebrate();
      } else ctx.sounds.error();
    }
  };

  return (
    <StationShell emoji="👕" title={title} subtitle={subtitle} strategy="التعلم البصري" onSpeak={() => ctx.speak(`الشرط السادس: ستر العورة. ${AWRAH.man} ${AWRAH.woman}`)}>
      <Card className="bg-gradient-to-l from-orange-50 to-white">
        <h3 className="text-2xl font-black text-turq-900">الشرط السادس: ستر العورة</h3>
        <button onClick={() => setStoryOpen((v) => !v)} className="mt-2 text-start font-bold text-brand-blue underline-offset-4 hover:underline">
          {storyOpen ? "إخفاء قصة سليمان ▲" : "📖 اقرأ قصة سليمان مع والده ▼"}
        </button>
        {storyOpen && <p className="mt-3 animate-fadeup rounded-2xl bg-white p-4 text-lg leading-loose text-slate-700 shadow-inner">{SULAIMAN_STORY}</p>}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="text-center">
          <div className="relative mx-auto h-64 w-48">
            <Image src="/images/man-prayer.png" alt="لباس الرجل المناسب للصلاة" fill priority className="object-contain" />
          </div>
          <h4 className="mt-3 text-xl font-black text-turq-900">عورة الرجل في الصلاة</h4>
          <p className="mt-1 rounded-2xl bg-turq-50 p-3 text-lg font-bold text-turq-900">من السرة إلى الركبة</p>
          <p className="mt-2 text-sm text-slate-500">ملابس ساترة من السرة إلى الركبة على الأقل.</p>
        </Card>
        <Card className="text-center">
          <div className="relative mx-auto h-64 w-48">
            <Image src="/images/woman-prayer.png" alt="لباس المرأة المناسب للصلاة" fill priority className="object-contain" />
          </div>
          <h4 className="mt-3 text-xl font-black text-turq-900">عورة المرأة في الصلاة</h4>
          <p className="mt-1 rounded-2xl bg-turq-50 p-3 text-lg font-bold text-turq-900">تغطي كامل جسدها ما عدا وجهها وكفيها</p>
          <p className="mt-2 text-sm text-slate-500">لباس واسع يغطي الجسد كله ما عدا الوجه والكفين.</p>
        </Card>
      </div>

      <Card>
        <h3 className="mb-4 text-xl font-black text-turq-900">✏️ أكمل القاعدتين</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="mb-2 font-bold">عورة الرجل في الصلاة:</p>
            <Choices choices={AWRAH_RULE_CHOICES.man} value={rules.man} onChange={(i) => setRules({ ...rules, man: i })} revealed={!!rulesResult} correct={0} disabled={!!rulesResult} />
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="mb-2 font-bold">عورة المرأة في الصلاة:</p>
            <Choices choices={AWRAH_RULE_CHOICES.woman} value={rules.woman} onChange={(i) => setRules({ ...rules, woman: i })} revealed={!!rulesResult} correct={0} disabled={!!rulesResult} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {!rulesResult ? (
            <Btn onClick={checkRules} disabled={rules.man === undefined || rules.woman === undefined || ctx.busy}>
              تحقق ✅
            </Btn>
          ) : (
            <>
              <ScoreBadge score={rulesResult.score} max={rulesResult.maxScore} />
              <Feedback kind={rulesResult.isCorrect ? "correct" : "info"}>{rulesResult.isCorrect ? "أحسنت! حفظت القاعدتين." : "راجع القاعدتين في البطاقتين أعلاه."}</Feedback>
              {!rulesResult.isCorrect && (
                <Btn variant="warning" onClick={() => setRulesResult(null)}>
                  🔁 حاول مرة أخرى
                </Btn>
              )}
            </>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-xl font-black text-turq-900">👀 ميّز اللباس المناسب للصلاة</h3>
        <p className="mb-4 text-sm text-slate-500">لكل لباس اختر: مناسب للصلاة أم غير مناسب.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {OUTFITS.map((o) => {
            const v = outfits[o.id];
            const r = outfitsResult?.detail?.[o.id];
            return (
              <div key={o.id} className={cx("rounded-2xl border-2 p-4", r === true ? "border-emerald-300 bg-emerald-50" : r === false ? "border-rose-300 bg-rose-50" : "border-slate-200")}>
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{o.emoji}</span>
                  <div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{o.who}</span>
                    <p className="font-bold text-slate-800">{o.label}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    { val: 1, label: "✅ مناسب" },
                    { val: 0, label: "🚫 غير مناسب" },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      disabled={!!outfitsResult}
                      onClick={() => setOutfits({ ...outfits, [o.id]: opt.val })}
                      className={cx(
                        "touch-target rounded-xl border-2 py-2 font-bold transition-all",
                        v === opt.val ? "border-turq-500 bg-turq-500 text-white" : "border-slate-200 bg-white hover:border-turq-300",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!outfitsResult ? (
            <Btn size="lg" onClick={checkOutfits} disabled={Object.keys(outfits).length < OUTFITS.length || ctx.busy}>
              تحقق ✅
            </Btn>
          ) : (
            <>
              <ScoreBadge score={outfitsResult.score} max={outfitsResult.maxScore} />
              <Feedback kind={outfitsResult.isCorrect ? "correct" : "info"}>
                {outfitsResult.isCorrect ? "رائع! تميز اللباس الساتر المناسب للصلاة." : "تذكر: اللباس المناسب هو الذي يستر العورة كما في القاعدتين."}
              </Feedback>
              {!outfitsResult.isCorrect && (
                <Btn variant="warning" onClick={() => setOutfitsResult(null)}>
                  🔁 حاول مرة أخرى
                </Btn>
              )}
            </>
          )}
        </div>
      </Card>
    </StationShell>
  );
}

/* ------------------------------------------------------------------ */
/*  المحطة 8: تدبر الآية                                                 */
/* ------------------------------------------------------------------ */

export function StationAyah({ ctx, title, subtitle }: StationProps) {
  const savedOrder = ctx.state.answers.ayah_order;
  const savedRel = ctx.state.answers.ayah_relation;
  const [order, setOrder] = useState<string[]>(() => (savedOrder ? ((rec(savedOrder.answer).order as string[]) ?? []) : []));
  const [orderResult, setOrderResult] = useState<ActivityResult | null>(savedOrder ? { ...savedOrder, needsReview: false } : null);
  const [rel, setRel] = useState<number | null>(() => (savedRel ? Number(rec(savedRel.answer).choice) : null));
  const [relResult, setRelResult] = useState<ActivityResult | null>(savedRel ? { ...savedRel, needsReview: false } : null);
  const words = useMemo(() => shuffle(EVIDENCE.ayah.words), []);

  const checkOrder = async () => {
    const r = await ctx.saveAnswer("ayah_order", { order });
    if (r) {
      setOrderResult(r);
      if (r.isCorrect) {
        ctx.sounds.success();
        ctx.celebrate();
      } else ctx.sounds.error();
    }
  };
  const checkRel = async (i: number) => {
    setRel(i);
    const r = await ctx.saveAnswer("ayah_relation", { choice: i });
    if (r) {
      setRelResult(r);
      r.isCorrect ? ctx.sounds.success() : ctx.sounds.error();
    }
  };

  return (
    <StationShell emoji="📖" title={title} subtitle={subtitle} strategy="الاستنتاج" onSpeak={() => ctx.speak(`قال الله تعالى: يا بني آدم خذوا زينتكم عند كل مسجد`)}>
      <EvidenceCard intro="قال الله تعالى:" text={EVIDENCE.ayah.text} source={EVIDENCE.ayah.source} quran />

      <Card>
        <h3 className="mb-1 text-xl font-black text-turq-900">1️⃣ اقرأ الآية ثم رتب كلماتها</h3>
        <p className="mb-4 text-sm text-slate-500">اضغط على الكلمات بالترتيب الصحيح لتكوين الآية الكريمة.</p>
        <OrderWords words={words} value={order} onChange={setOrder} disabled={!!orderResult} status={orderResult ? (orderResult.isCorrect ? "correct" : "wrong") : null} />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {!orderResult ? (
            <Btn onClick={checkOrder} disabled={order.length < EVIDENCE.ayah.words.length || ctx.busy}>
              تحقق ✅
            </Btn>
          ) : orderResult.isCorrect ? (
            <Feedback kind="correct">أحسنت! رتبت كلمات الآية ترتيبًا صحيحًا.</Feedback>
          ) : (
            <>
              <Feedback kind="wrong">الترتيب غير صحيح؛ اقرأ الآية في الأعلى ثم حاول مرة أخرى.</Feedback>
              <Btn
                variant="warning"
                onClick={() => {
                  setOrder([]);
                  setOrderResult(null);
                }}
              >
                🔁 حاول مرة أخرى
              </Btn>
            </>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-xl font-black text-turq-900">2️⃣ {AYAH_RELATION.text}</h3>
        <Choices choices={AYAH_RELATION.choices} value={rel} onChange={checkRel} revealed={!!relResult} correct={AYAH_RELATION.correct} disabled={!!relResult} />
        {relResult && (
          <div className="mt-3 space-y-3">
            <Feedback kind={relResult.isCorrect ? "correct" : "wrong"}>{relResult.isCorrect ? "استنتاج صحيح!" : "ليس هذا هو الاستنتاج الصحيح."}</Feedback>
            <Feedback kind="info">{EVIDENCE.ayah.conclusion}</Feedback>
            {!relResult.isCorrect && (
              <Btn
                variant="warning"
                onClick={() => {
                  setRel(null);
                  setRelResult(null);
                }}
              >
                🔁 حاول مرة أخرى
              </Btn>
            )}
          </div>
        )}
      </Card>

      {ctx.state.settings.allowAudio && (
        <Card>
          <h3 className="mb-2 text-xl font-black text-turq-900">3️⃣ 🎙️ سجّل قراءتك للآية (اختياري)</h3>
          <p className="mb-3 text-sm text-slate-500">سيستمع المعلم إلى قراءتك من لوحة التحكم.</p>
          <AudioRecorder saved={ctx.state.audioSlides.includes("ayah")} onSave={(d) => ctx.uploadAudio("ayah", "ayah_recite", d)} />
        </Card>
      )}
    </StationShell>
  );
}
