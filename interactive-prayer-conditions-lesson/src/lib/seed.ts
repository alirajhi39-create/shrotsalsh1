import { db } from "@/db";
import { ensureSchema } from "@/db/bootstrap";
import {
  teachers,
  classrooms,
  lessons,
  lessonSlides,
  activities,
  questions,
  teacherSettings,
  audioRecordings,
  lessonMedia,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { hashPassword } from "./auth";
import { LESSON, SLIDES, ACTIVITIES, EVIDENCE } from "./content";

export const DEFAULT_TEACHER_USERNAME = process.env.TEACHER_USERNAME ?? "teacher";
export const DEFAULT_TEACHER_PASSWORD = process.env.TEACHER_PASSWORD ?? "";

type SeedQuestion = {
  key: string;
  slideKey: "book" | "quiz";
  kind: string;
  prompt: string;
  options: Record<string, unknown>;
  answer: Record<string, unknown>;
  explanation: string;
  skill: string;
  points: number;
};

const ORDER_WORDS = ["عند إرادة", "النجاسة", "عن البدن", "ومكان الصلاة", "تجب إزالة", "والملابس", "الصلاة"];
const ORDER_ANSWER = ["عند إرادة", "الصلاة", "تجب إزالة", "النجاسة", "عن البدن", "والملابس", "ومكان الصلاة"];

export const SEED_QUESTIONS: SeedQuestion[] = [
  /* ---------- نشاط الكتاب المدرسي ---------- */
  {
    key: "book_najasa_fill",
    slideKey: "book",
    kind: "multi",
    prompt:
      "أتذكر ما تعلمته في وحدة إزالة النجاسة، ثم أكمل: عند إرادة الصلاة تجب إزالة النجاسة عن ثلاثة أشياء هي: (١) البدن، (٢) ........، (٣) ........",
    options: { choices: ["الملابس", "الطعام", "مكان الصلاة", "الكتاب", "السيارة"] },
    answer: { indices: [0, 2] },
    explanation: "المواضع الثلاثة هي: البدن، والملابس، ومكان الصلاة.",
    skill: "إزالة النجاسة",
    points: 2,
  },
  {
    key: "book_hadith_extract",
    slideKey: "book",
    kind: "multi",
    prompt: `${EVIDENCE.hadithRafa.intro} ${EVIDENCE.hadithRafa.text}. أستخرج من الحديث من لا تجب عليهم الصلاة:`,
    options: { choices: ["الصغير حتى يكبر", "المسافر", "المجنون حتى يعقل", "الكبير في السن"] },
    answer: { indices: [0, 2] },
    explanation: "ذكر الحديث: الصغير حتى يكبر، والمجنون حتى يعقل.",
    skill: "الإسلام والتمييز والعقل",
    points: 2,
  },
  {
    key: "book_ayah_relation",
    slideKey: "book",
    kind: "essay",
    prompt: `قال الله تعالى: ${EVIDENCE.ayah.text}. أقرأ الآية الكريمة وأستنتج منها العلاقة بينها وبين ستر العورة في الصلاة:`,
    options: { minLength: 5 },
    answer: { modelAnswer: EVIDENCE.ayah.conclusion, keywords: ["الزينة", "اللباس", "ستر", "العورة"] },
    explanation: EVIDENCE.ayah.conclusion,
    skill: "الاستنتاج",
    points: 2,
  },
  {
    key: "book_order_sentence",
    slideKey: "book",
    kind: "order",
    prompt: "أرتب الكلمات الآتية لتصبح جملة مفيدة:",
    options: { words: ORDER_WORDS },
    answer: { order: ORDER_ANSWER },
    explanation: "عند إرادة الصلاة تجب إزالة النجاسة عن البدن والملابس ومكان الصلاة.",
    skill: "إزالة النجاسة",
    points: 2,
  },
  /* ---------- التقويم الختامي ---------- */
  {
    key: "quiz_age",
    slideKey: "quiz",
    kind: "mcq",
    prompt: "سن التمييز هو:",
    options: { choices: ["5 سنوات", "7 سنوات", "9 سنوات"] },
    answer: { index: 1 },
    explanation: "لا يؤمر الصغير بالصلاة حتى يبلغ سبع سنين.",
    skill: "الإسلام والتمييز والعقل",
    points: 1,
  },
  {
    key: "quiz_fourth",
    slideKey: "quiz",
    kind: "mcq",
    prompt: "الشرط الرابع من شروط الصلاة هو:",
    options: { choices: ["الطهارة", "العقل", "ستر العورة", "التمييز"] },
    answer: { index: 0 },
    explanation: "الشرط الرابع: الطهارة.",
    skill: "الطهارة",
    points: 1,
  },
  {
    key: "quiz_fifth",
    slideKey: "quiz",
    kind: "mcq",
    prompt: "الشرط الخامس من شروط الصلاة هو:",
    options: { choices: ["الإسلام", "إزالة النجاسة", "العقل", "الطهارة"] },
    answer: { index: 1 },
    explanation: "الشرط الخامس: إزالة النجاسة.",
    skill: "إزالة النجاسة",
    points: 1,
  },
  {
    key: "quiz_awrah_man",
    slideKey: "quiz",
    kind: "fill",
    prompt: "أكمل الفراغ: عورة الرجل في الصلاة ........",
    options: { choices: ["من السرة إلى الركبة", "من الكتف إلى القدم", "الوجه والكفان"] },
    answer: { index: 0 },
    explanation: "عورة الرجل في الصلاة من السرة إلى الركبة.",
    skill: "ستر العورة",
    points: 1,
  },
  {
    key: "quiz_awrah_woman",
    slideKey: "quiz",
    kind: "fill",
    prompt: "أكمل الفراغ: عورة المرأة في الصلاة ........",
    options: { choices: ["تغطي كامل جسدها ما عدا وجهها وكفيها", "من السرة إلى الركبة", "تغطي الرأس فقط"] },
    answer: { index: 0 },
    explanation: "عورة المرأة في الصلاة: تغطي كامل جسدها ما عدا وجهها وكفيها.",
    skill: "ستر العورة",
    points: 1,
  },
  {
    key: "quiz_order",
    slideKey: "quiz",
    kind: "order",
    prompt: "رتب الكلمات لتكوين جملة مفيدة:",
    options: { words: ORDER_WORDS },
    answer: { order: ORDER_ANSWER },
    explanation: "عند إرادة الصلاة تجب إزالة النجاسة عن البدن والملابس ومكان الصلاة.",
    skill: "إزالة النجاسة",
    points: 2,
  },
  {
    key: "quiz_tf_islam",
    slideKey: "quiz",
    kind: "truefalse",
    prompt: "لا تصح الصلاة بدون الإسلام.",
    options: {},
    answer: { value: true },
    explanation: "الإسلام هو الشرط الأول، فلا تصح الصلاة بدونه.",
    skill: "الإسلام والتمييز والعقل",
    points: 1,
  },
  {
    key: "quiz_tf_majnoon",
    slideKey: "quiz",
    kind: "truefalse",
    prompt: "تجب الصلاة على المجنون.",
    options: {},
    answer: { value: false },
    explanation: "العقل شرط، فلا تجب الصلاة على المجنون.",
    skill: "الإسلام والتمييز والعقل",
    points: 1,
  },
  {
    key: "quiz_tf_woman",
    slideKey: "quiz",
    kind: "truefalse",
    prompt: "عورة المرأة في الصلاة تغطي كامل جسدها ما عدا وجهها وكفيها.",
    options: {},
    answer: { value: true },
    explanation: "هذه هي قاعدة عورة المرأة في الصلاة كما في الدرس.",
    skill: "ستر العورة",
    points: 1,
  },
  {
    key: "quiz_dragdrop",
    slideKey: "quiz",
    kind: "dragdrop",
    prompt: "اسحب كل عمل إلى الشرط الذي يدل عليه:",
    options: {
      items: ["الوضوء قبل الصلاة", "غسل الثوب من النجاسة", "لبس ثوب يستر العورة"],
      zones: ["الطهارة", "إزالة النجاسة", "ستر العورة"],
    },
    answer: {
      map: {
        "الوضوء قبل الصلاة": "الطهارة",
        "غسل الثوب من النجاسة": "إزالة النجاسة",
        "لبس ثوب يستر العورة": "ستر العورة",
      },
    },
    explanation: "الوضوء للطهارة، وغسل الثوب لإزالة النجاسة، ولبس الثوب الساتر لستر العورة.",
    skill: "الاستنتاج",
    points: 3,
  },
  {
    key: "quiz_sit_sulaiman",
    slideKey: "quiz",
    kind: "situation",
    prompt: "أراد سليمان أن يصلي وكان يرتدي ملابس فوق الركبة. ما الشرط الذي أخلّ به؟",
    options: { choices: ["ستر العورة", "الطهارة", "التمييز"] },
    answer: { index: 0 },
    explanation: "ملابسه لا تغطي العورة، ومن شروط الصلاة ستر العورة.",
    skill: "ستر العورة",
    points: 1,
  },
  {
    key: "quiz_sit_seven",
    slideKey: "quiz",
    kind: "situation",
    prompt: "بلغ عبدالله سبع سنين. ماذا يفعل والده؟",
    options: { choices: ["يأمره بالصلاة", "ينتظر حتى يبلغ تسع سنين", "لا يأمره بالصلاة أبدًا"] },
    answer: { index: 0 },
    explanation: "يُؤمر الصغير بالصلاة إذا بلغ سبع سنين.",
    skill: "الإسلام والتمييز والعقل",
    points: 1,
  },
  {
    key: "quiz_hadith_tahara",
    slideKey: "quiz",
    kind: "mcq",
    prompt: `حديث ${EVIDENCE.hadithTahara.text} يدل على شرط:`,
    options: { choices: ["الطهارة", "الإسلام", "العقل"] },
    answer: { index: 0 },
    explanation: "الحديث دليل على اشتراط الطهارة للصلاة.",
    skill: "الطهارة",
    points: 1,
  },
  {
    key: "quiz_sit_place",
    slideKey: "quiz",
    kind: "situation",
    prompt: "لاحظت مريم نجاسة على سجادة الصلاة. ماذا تفعل قبل أن تصلي؟",
    options: { choices: ["تنظف المكان أو تصلي في مكان طاهر", "تصلي عليها مباشرة", "تغطيها بمنديل وتصلي"] },
    answer: { index: 0 },
    explanation: "تجب إزالة النجاسة عن مكان الصلاة.",
    skill: "إزالة النجاسة",
    points: 1,
  },
  {
    key: "quiz_essay_ayah",
    slideKey: "quiz",
    kind: "essay",
    prompt: `اكتب بأسلوبك: ما العلاقة بين قوله تعالى ${EVIDENCE.ayah.text} وستر العورة في الصلاة؟`,
    options: { minLength: 5 },
    answer: { modelAnswer: EVIDENCE.ayah.conclusion, keywords: ["الزينة", "اللباس", "ستر", "العورة"] },
    explanation: EVIDENCE.ayah.conclusion,
    skill: "الاستنتاج",
    points: 2,
  },
];

let seedPromise: Promise<number> | null = null;

/** يضمن وجود بيانات الدرس الأساسية؛ آمن للتكرار ولا يمس تعديلات المعلم. يعيد معرف الدرس. */
export function ensureSeeded(): Promise<number> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<number> {
  // شبكة أمان: إنشاء الجداول إن لم تكن موجودة (نشر جديد بدون تنفيذ الهجرات)
  await ensureSchema();

  // المعلم الافتراضي
  let [teacher] = await db.select().from(teachers).limit(1);
  if (!teacher) {
    if (!DEFAULT_TEACHER_PASSWORD) throw new Error("TEACHER_PASSWORD is required to initialize the first teacher account");
    [teacher] = await db
      .insert(teachers)
      .values({
        username: DEFAULT_TEACHER_USERNAME,
        passwordHash: hashPassword(DEFAULT_TEACHER_PASSWORD),
        name: LESSON.teacher,
        school: LESSON.school,
      })
      .onConflictDoNothing()
      .returning();
    if (!teacher) [teacher] = await db.select().from(teachers).limit(1);
  }

  // الفصول الافتراضية (فقط إذا لم يكن للمعلم أي فصل)
  const [{ count: classCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(classrooms)
    .where(eq(classrooms.teacherId, teacher.id));
  if (Number(classCount) === 0) {
    await db
      .insert(classrooms)
      .values([
        { teacherId: teacher.id, name: "الثالث (أ)" },
        { teacherId: teacher.id, name: "الثالث (ب)" },
      ])
      .onConflictDoNothing();
  }

  // الدرس
  let [lesson] = await db.select().from(lessons).where(eq(lessons.slug, LESSON.slug)).limit(1);
  if (!lesson) {
    [lesson] = await db
      .insert(lessons)
      .values({
        slug: LESSON.slug,
        title: LESSON.title,
        subject: LESSON.subject,
        grade: LESSON.grade,
        lessonNumber: LESSON.lessonNumber,
        pages: LESSON.pages,
      })
      .onConflictDoNothing()
      .returning();
    if (!lesson) [lesson] = await db.select().from(lessons).where(eq(lessons.slug, LESSON.slug)).limit(1);
  }

  // الشرائح
  await db
    .insert(lessonSlides)
    .values(
      SLIDES.map((s, i) => ({
        lessonId: lesson.id,
        key: s.key,
        orderIndex: i,
        title: s.title,
        subtitle: s.subtitle,
        strategy: s.strategy,
        isRequired: true,
        config: { emoji: s.emoji },
      })),
    )
    .onConflictDoNothing();

  const slideRows = await db.select().from(lessonSlides).where(eq(lessonSlides.lessonId, lesson.id));
  const slideIdByKey = new Map(slideRows.map((s) => [s.key, s.id]));

  // الأنشطة
  const activityValues = Object.entries(ACTIVITIES)
    .map(([key, a], i) => {
      const slideId = slideIdByKey.get(a.slideKey);
      if (!slideId) return null;
      return {
        slideId,
        key,
        title: a.title,
        kind: a.kind,
        isRequired: a.required,
        maxScore: a.maxScore,
        orderIndex: i,
        config: {},
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);
  if (activityValues.length) {
    await db.insert(activities).values(activityValues).onConflictDoNothing();
  }

  // الأسئلة
  await db
    .insert(questions)
    .values(
      SEED_QUESTIONS.map((q, i) => ({
        lessonId: lesson.id,
        slideKey: q.slideKey,
        key: q.key,
        kind: q.kind,
        prompt: q.prompt,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        skill: q.skill,
        points: q.points,
        orderIndex: i,
        active: true,
      })),
    )
    .onConflictDoNothing();

  // إعدادات المعلم
  const existingSettings = await db
    .select({ id: teacherSettings.id })
    .from(teacherSettings)
    .where(and(eq(teacherSettings.teacherId, teacher.id), eq(teacherSettings.lessonId, lesson.id)))
    .limit(1);
  if (!existingSettings.length) {
    await db
      .insert(teacherSettings)
      .values({ teacherId: teacher.id, lessonId: lesson.id, passPercent: 80, maxAttempts: 2 })
      .onConflictDoNothing();
  }

  // ترحيل غير هدّام لمقاطع المعلم القديمة إلى مكتبة وسائط الدرس المنشورة.
  // تبقى النسخة الأصلية في audio_recordings، وتسجيلات الطلاب لا تُنشر أبدًا.
  const legacyClips = await db
    .select()
    .from(audioRecordings)
    .where(and(eq(audioRecordings.lessonId, lesson.id), eq(audioRecordings.kind, "teacher")));
  for (const clip of legacyClips) {
    await db
      .insert(lessonMedia)
      .values({
        lessonId: lesson.id,
        teacherId: teacher.id,
        kind: "audio",
        slideKey: SLIDES.some((s) => s.key === clip.slideKey) ? clip.slideKey : "intro",
        title: clip.title || "شرح المعلم",
        source: "uploaded",
        mimeType: clip.mimeType,
        dataBase64: clip.dataBase64,
        sizeBytes: Buffer.byteLength(clip.dataBase64, "base64"),
        active: true,
        legacyAudioId: clip.id,
        createdAt: clip.createdAt,
      })
      .onConflictDoNothing({ target: lessonMedia.legacyAudioId });
  }

  return lesson.id;
}
