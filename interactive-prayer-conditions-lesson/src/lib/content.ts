/**
 * المحتوى العلمي المعتمد لدرس «شروط الصلاة (1)» – الصف الثالث الابتدائي – الدرس السابع (ص 63–65)
 * جميع النصوص الدينية منقولة كما وردت في الكتاب المدرسي.
 */

export const LESSON = {
  slug: "shurut-alsalah-1",
  title: "شروط الصلاة (1)",
  subject: "الدراسات الإسلامية – الفقه",
  grade: "الصف الثالث الابتدائي",
  lessonNumber: 7,
  pages: "63–65",
  school: "العروس الابتدائية",
  teacher: "علي عبدالله راجحي",
};

export const CONDITIONS = [
  {
    key: "islam",
    order: 1,
    ordinal: "الأول",
    name: "الإسلام",
    text: "فلا تصح الصلاة بدونه.",
    simple: "الصلاة لا تصح إلا من المسلم.",
    icon: "🕌",
    color: "from-teal-400 to-teal-600",
    example: "المسلم يؤدي الصلاة؛ فالإسلام هو الشرط الأول.",
  },
  {
    key: "tamyeez",
    order: 2,
    ordinal: "الثاني",
    name: "التمييز",
    text: "فلا يؤمر الصغير بالصلاة حتى يبلغ سبع سنين.",
    simple: "يُؤمر الصغير بالصلاة عندما يبلغ سبع سنين.",
    icon: "🧒",
    color: "from-sky-400 to-sky-600",
    example: "بلغ أحمد سبع سنين فأمره أبوه بالصلاة.",
  },
  {
    key: "aql",
    order: 3,
    ordinal: "الثالث",
    name: "العقل",
    text: "فلا تجب الصلاة على المجنون.",
    simple: "الصلاة لا تجب على المجنون.",
    icon: "🧠",
    color: "from-indigo-400 to-indigo-600",
    example: "المجنون لا تجب عليه الصلاة حتى يعقل.",
  },
  {
    key: "tahara",
    order: 4,
    ordinal: "الرابع",
    name: "الطهارة",
    text: "قال النبي ﷺ: «لَا يَقْبَلُ اللهُ صَلَاةَ أَحَدِكُمْ إِذَا أَحْدَثَ حَتَّى يَتَوَضَّأَ».",
    simple: "من أحدث فلا تُقبل صلاته حتى يتوضأ.",
    icon: "💧",
    color: "from-cyan-400 to-cyan-600",
    example: "توضأ خالد قبل الصلاة.",
  },
  {
    key: "najasa",
    order: 5,
    ordinal: "الخامس",
    name: "إزالة النجاسة",
    text: "عند إرادة الصلاة تجب إزالة النجاسة عن البدن والملابس ومكان الصلاة.",
    simple: "أزيل النجاسة عن بدني وملابسي ومكان صلاتي.",
    icon: "🧼",
    color: "from-emerald-400 to-emerald-600",
    example: "غسلت فاطمة ثوبها من النجاسة قبل الصلاة.",
  },
  {
    key: "awrah",
    order: 6,
    ordinal: "السادس",
    name: "ستر العورة",
    text: "عورة الرجل من السرة إلى الركبة، وعورة المرأة تغطي كامل جسدها ما عدا وجهها وكفيها في الصلاة.",
    simple: "ألبس ملابس تستر عورتي عند الصلاة.",
    icon: "👕",
    color: "from-orange-400 to-orange-600",
    example: "لبس سليمان ثوبًا طويلًا يستر عورته.",
  },
] as const;

export type ConditionKey = (typeof CONDITIONS)[number]["key"];

export const EVIDENCE = {
  hadithTahara: {
    text: "«لَا يَقْبَلُ اللهُ صَلَاةَ أَحَدِكُمْ إِذَا أَحْدَثَ حَتَّى يَتَوَضَّأَ»",
    intro: "لحديث أبي هريرة رضي الله عنه أن النبي ﷺ قال:",
    source: "أخرجه مسلم (225)",
  },
  hadithRafa: {
    text: "«رُفِعَ الْقَلَمُ عَنْ ثَلَاثَةٍ» وذكر منهم: «الصَّغِيرَ حَتَّى يَكْبُرَ، وَالْمَجْنُونَ حَتَّى يَعْقِلَ»",
    intro: "قال رسول الله ﷺ:",
    source: "أخرجه أبو داود (4403)، والترمذي (1423)",
  },
  ayah: {
    text: "﴿يَا بَنِي آدَمَ خُذُوا زِينَتَكُمْ عِندَ كُلِّ مَسْجِدٍ﴾",
    words: ["يَا بَنِي", "آدَمَ", "خُذُوا", "زِينَتَكُمْ", "عِندَ", "كُلِّ", "مَسْجِدٍ"],
    source: "سورة الأعراف، الآية (31)",
    conclusion:
      "تدل الآية على أخذ الزينة واللباس المناسب عند الصلاة، ومن ذلك ستر العورة.",
  },
};

export const NAJASA_PLACES = [
  { key: "body", label: "البدن", icon: "🙋" },
  { key: "clothes", label: "الملابس", icon: "👕" },
  { key: "place", label: "مكان الصلاة", icon: "🧎" },
] as const;

export const AWRAH = {
  man: "عورة الرجل في الصلاة: من السرة إلى الركبة.",
  woman: "عورة المرأة في الصلاة: تغطي كامل جسدها ما عدا وجهها وكفيها.",
};

export const SULAIMAN_STORY =
  "أراد سليمان أن يصلي، وكان يرتدي ملابس فوق الركبة، فقال له أبوه: لقد أخطأت بلبس هذا اللباس، ثم إنك أخللت بشرط من شروط الصلاة، فقال سليمان: ما هو يا أبي العزيز؟ قال الأب: إن ملابسك يا بني لا تغطي العورة، ومن شروط الصلاة ستر العورة للرجل والمرأة، قال سليمان: وما عورة الرجل والمرأة في الصلاة؟ فأجابه أبوه أن عورة الرجل والمرأة في الصلاة كالتالي: عورة الرجل من السرة إلى الركبة، وعورة المرأة تغطي كامل جسدها ما عدا وجهها وكفيها في الصلاة.";

/* ------------------------------------------------------------------ */
/*  المحطات                                                             */
/* ------------------------------------------------------------------ */

export const SLIDES = [
  { key: "intro", title: "هل صلاتي صحيحة؟", subtitle: "التهيئة المشوقة", strategy: "العصف الذهني وأسئلة التوقع", emoji: "🤔" },
  { key: "discover", title: "اكتشف شروط الصلاة", subtitle: "ست بطاقات سرية", strategy: "التعلم بالاكتشاف", emoji: "🃏" },
  { key: "three", title: "الإسلام والتمييز والعقل", subtitle: "مواقف من حياتنا", strategy: "التعلم بالمواقف", emoji: "🧒" },
  { key: "tahara", title: "الطهارة", subtitle: "شاهد وفكر وأجب", strategy: "شاهد – فكر – أجب", emoji: "💧" },
  { key: "najasa", title: "إزالة النجاسة", subtitle: "اسحب وأفلت", strategy: "السحب والإفلات", emoji: "🧼" },
  { key: "detective", title: "تحدي اكتشاف الخطأ", subtitle: "المحقق الصغير", strategy: "المحقق الصغير", emoji: "🔍" },
  { key: "awrah", title: "ستر العورة", subtitle: "اللباس المناسب للصلاة", strategy: "التعلم البصري", emoji: "👕" },
  { key: "ayah", title: "تدبر الآية", subtitle: "سورة الأعراف (31)", strategy: "الاستنتاج", emoji: "📖" },
  { key: "classify", title: "صنف الشروط", subtitle: "كل موقف تحت شرطه", strategy: "التصنيف والتعلم التعاوني", emoji: "🗂️" },
  { key: "book", title: "نشاط الكتاب المدرسي", subtitle: "تدريبات إلكترونية", strategy: "التدريب والممارسة", emoji: "📘" },
  { key: "quiz", title: "التقويم الختامي", subtitle: "اختبر نفسك", strategy: "التقويم التفاعلي", emoji: "📝" },
  { key: "champion", title: "بطل شروط الصلاة", subtitle: "التحدي النهائي والشهادة", strategy: "التعلم باللعب", emoji: "🏆" },
] as const;

export type SlideKey = (typeof SLIDES)[number]["key"];

/* ------------------------------------------------------------------ */
/*  أنشطة المحطات ومفاتيح تصحيحها                                        */
/* ------------------------------------------------------------------ */

export type ActivityResult = {
  isCorrect: boolean | null;
  score: number;
  maxScore: number;
  needsReview: boolean;
  detail?: Record<string, boolean>;
};

export type ActivityDef = {
  slideKey: SlideKey;
  title: string;
  kind: string;
  required: boolean;
  maxScore: number;
  grade: (answer: unknown) => ActivityResult;
};

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const mapGrade = (answer: unknown, key: Record<string, string>): ActivityResult => {
  const a = asRecord(answer);
  const detail: Record<string, boolean> = {};
  let score = 0;
  for (const [item, zone] of Object.entries(key)) {
    const ok = a[item] === zone;
    detail[item] = ok;
    if (ok) score += 1;
  }
  const max = Object.keys(key).length;
  return { isCorrect: score === max, score, maxScore: max, needsReview: false, detail };
};

const choiceGrade = (answer: unknown, correct: number): ActivityResult => {
  const a = asRecord(answer);
  const ok = Number(a.choice) === correct;
  return { isCorrect: ok, score: ok ? 1 : 0, maxScore: 1, needsReview: false };
};

const multiChoiceGrade = (answer: unknown, correct: Record<string, number>): ActivityResult => {
  const a = asRecord(answer);
  const detail: Record<string, boolean> = {};
  let score = 0;
  for (const [k, v] of Object.entries(correct)) {
    const ok = Number(a[k]) === v;
    detail[k] = ok;
    if (ok) score += 1;
  }
  const max = Object.keys(correct).length;
  return { isCorrect: score === max, score, maxScore: max, needsReview: false, detail };
};

const participationGrade = (answer: unknown): ActivityResult => {
  const a = asRecord(answer);
  const hasText = typeof a.text === "string" && a.text.trim().length > 0;
  const hasAudio = a.audio === true;
  const hasChoices = Array.isArray(a.choices) && a.choices.length > 0;
  const ok = hasText || hasAudio || hasChoices || a.done === true;
  return { isCorrect: ok ? true : null, score: ok ? 1 : 0, maxScore: 1, needsReview: false };
};

const orderGrade = (answer: unknown, correct: readonly string[]): ActivityResult => {
  const a = asRecord(answer);
  const order = Array.isArray(a.order) ? (a.order as unknown[]) : [];
  const ok = order.length === correct.length && order.every((w, i) => w === correct[i]);
  return { isCorrect: ok, score: ok ? 1 : 0, maxScore: 1, needsReview: false };
};

/* --- المحطة 2: المطابقة --- */
export const DISCOVER_MEANINGS: Record<ConditionKey, string> = {
  islam: "فلا تصح الصلاة بدونه",
  tamyeez: "فلا يؤمر الصغير بالصلاة حتى يبلغ سبع سنين",
  aql: "فلا تجب الصلاة على المجنون",
  tahara: "لا يقبل الله صلاة أحدكم إذا أحدث حتى يتوضأ",
  najasa: "عن البدن والملابس ومكان الصلاة",
  awrah: "عورة الرجل من السرة إلى الركبة",
};

/* --- المحطة 3: المواقف --- */
export const THREE_SITUATIONS = [
  {
    key: "s1",
    emoji: "👶",
    text: "خالد عمره خمس سنوات، ولم يأمره أبوه بالصلاة بعد. لماذا؟",
    choices: [
      "لأنه لم يبلغ سن التمييز (سبع سنين)",
      "لأنه لا يحب الصلاة",
      "لأن الصلاة لا تجب على الأطفال أبدًا",
    ],
    correct: 0,
  },
  {
    key: "s2",
    emoji: "🧠",
    text: "رجل فقد عقله (مجنون) لا يدري ما يفعل. هل تجب عليه الصلاة؟",
    choices: ["تجب عليه الصلاة", "لا تجب عليه الصلاة", "تجب عليه صلاة الجمعة فقط"],
    correct: 1,
  },
  {
    key: "s3",
    emoji: "🕌",
    text: "ما الشرط الأول من شروط الصلاة الذي لا تصح الصلاة بدونه؟",
    choices: ["الإسلام", "الطهارة", "ستر العورة"],
    correct: 0,
  },
] as const;

export const AGE_QUESTION = {
  text: "كم سن التمييز المذكور في الدرس؟",
  choices: ["5 سنوات", "7 سنوات", "9 سنوات"],
  correct: 1,
  feedback:
    "سن التمييز سبع سنين؛ فعندها يُؤمر الصغير بالصلاة ليتعودها. أما قبل ذلك فهو صغير «رُفع عنه القلم حتى يكبر» كما في الحديث، فإذا كبر وبلغ وجبت عليه الصلاة.",
};

/* --- المحطة 4: الطهارة --- */
export const TAHARA_QUESTIONS = [
  {
    key: "t1",
    text: "ماذا يفعل المسلم إذا أحدث وأراد الصلاة؟",
    choices: ["يتوضأ", "يصلي مباشرة", "ينتظر حتى الصلاة التالية"],
    correct: 0,
  },
  {
    key: "t2",
    text: "الحديث «لا يقبل الله صلاة أحدكم إذا أحدث حتى يتوضأ» يدل على الشرط:",
    choices: ["الرابع: الطهارة", "الأول: الإسلام", "السادس: ستر العورة"],
    correct: 0,
  },
  {
    key: "t3",
    text: "أستنتج: لماذا الطهارة مهمة قبل الصلاة؟",
    choices: [
      "لأن الله لا يقبل صلاة من أحدث حتى يتوضأ",
      "لأنها عادة من عادات الناس فقط",
      "لأنها تجعل الصلاة أسرع",
    ],
    correct: 0,
  },
] as const;

/* --- المحطة 5: السحب والإفلات --- */
export const NAJASA_CARDS = [
  { id: "c1", label: "نجاسة على اليد", emoji: "🖐️", zone: "body" },
  { id: "c2", label: "بقعة نجاسة على الثوب", emoji: "👕", zone: "clothes" },
  { id: "c3", label: "نجاسة على سجادة الصلاة", emoji: "🧎", zone: "place" },
  { id: "c4", label: "نجاسة على القدم", emoji: "🦶", zone: "body" },
  { id: "c5", label: "نجاسة على الجورب", emoji: "🧦", zone: "clothes" },
  { id: "c6", label: "نجاسة على أرض الغرفة التي أصلي فيها", emoji: "🏠", zone: "place" },
] as const;

/* --- المحطة 6: المحقق الصغير --- */
export const DETECTIVE_CASES = [
  {
    key: "detective_case_1",
    emoji: "👕",
    title: "القضية الأولى",
    text: "سعد يريد أن يصلي، لكنه لاحظ بقعة نجاسة على ثوبه.",
    whereChoices: ["البدن", "الملابس", "مكان الصلاة"],
    whereCorrect: 1,
    fixChoices: ["أغسل الثوب أو أبدّله بثوب طاهر", "أصلي به كما هو", "أخفي البقعة بيدي أثناء الصلاة"],
    fixCorrect: 0,
  },
  {
    key: "detective_case_2",
    emoji: "🧎",
    title: "القضية الثانية",
    text: "فرشت نورة سجادتها، فوجدت على المكان نجاسة.",
    whereChoices: ["البدن", "الملابس", "مكان الصلاة"],
    whereCorrect: 2,
    fixChoices: ["أصلي في نفس المكان", "أنظّف المكان أو أصلي في مكان طاهر", "أضع ورقة فوق النجاسة وأصلي"],
    fixCorrect: 1,
  },
  {
    key: "detective_case_3",
    emoji: "🖐️",
    title: "القضية الثالثة",
    text: "أصابت يد فهد نجاسة وهو يلعب، وحان وقت الصلاة.",
    whereChoices: ["البدن", "الملابس", "مكان الصلاة"],
    whereCorrect: 0,
    fixChoices: ["أتجاهلها وأصلي", "أمسحها بثوبي فقط", "أغسل موضع النجاسة من بدني"],
    fixCorrect: 2,
  },
] as const;

/* --- المحطة 7: اللباس المناسب --- */
export const OUTFITS = [
  { id: "o1", who: "رجل", emoji: "👳", label: "ثوب طويل يستر من السرة إلى ما بعد الركبة", suitable: true },
  { id: "o2", who: "رجل", emoji: "🩳", label: "سروال قصير فوق الركبة (مثل لباس سليمان)", suitable: false },
  { id: "o3", who: "امرأة", emoji: "🧕", label: "لباس يغطي كامل الجسد ما عدا الوجه والكفين", suitable: true },
  { id: "o4", who: "امرأة", emoji: "👚", label: "لباس صلاة يكشف الذراعين", suitable: false },
] as const;

/* --- المحطة 8: الآية --- */
export const AYAH_RELATION = {
  text: "ما العلاقة بين الآية الكريمة وستر العورة في الصلاة؟",
  choices: [
    "تأمر الآية بأخذ الزينة واللباس المناسب عند الصلاة، ومن ذلك ستر العورة",
    "تأمر الآية ببناء المساجد وتزيينها فقط",
    "تأمر الآية بالأكل والشرب قبل الصلاة",
  ],
  correct: 0,
};

/* --- المحطة 9: التصنيف --- */
export const CLASSIFY_CARDS = [
  { id: "k1", label: "لا تصح الصلاة من غير المسلم", zone: "islam" },
  { id: "k2", label: "بلغ أحمد سبع سنين فأمره أبوه بالصلاة", zone: "tamyeez" },
  { id: "k3", label: "المجنون لا تجب عليه الصلاة", zone: "aql" },
  { id: "k4", label: "توضأ خالد قبل أن يصلي", zone: "tahara" },
  { id: "k5", label: "غسلت فاطمة ثوبها من النجاسة قبل الصلاة", zone: "najasa" },
  { id: "k6", label: "لبس سليمان ثوبًا طويلًا يستر عورته", zone: "awrah" },
  { id: "k7", label: "نظّف سعد مكان صلاته قبل أن يصلي", zone: "najasa" },
  { id: "k8", label: "من أحدث لا تُقبل صلاته حتى يتوضأ", zone: "tahara" },
] as const;

/* --- المحطة 12: التحدي النهائي --- */
export const CHAMPION_LEVELS = [
  { key: "islam", text: "لا تصح الصلاة بدون ...", choices: ["الإسلام", "السفر", "الطعام"], correct: 0 },
  { key: "tamyeez", text: "يُؤمر الصغير بالصلاة إذا بلغ ...", choices: ["ثلاث سنين", "سبع سنين", "خمس عشرة سنة"], correct: 1 },
  { key: "aql", text: "لا تجب الصلاة على ...", choices: ["المسافر", "الكبير", "المجنون"], correct: 2 },
  { key: "tahara", text: "«لا يقبل الله صلاة أحدكم إذا أحدث حتى ...»", choices: ["ينام", "يتوضأ", "يأكل"], correct: 1 },
  { key: "najasa", text: "تجب إزالة النجاسة عن البدن والملابس و...", choices: ["مكان الصلاة", "الكتاب", "السيارة"], correct: 0 },
  { key: "awrah", text: "عورة الرجل في الصلاة من ...", choices: ["الرأس إلى القدم", "السرة إلى الركبة", "الكتف إلى اليد"], correct: 1 },
] as const;

const najasaKey = Object.fromEntries(NAJASA_CARDS.map((c) => [c.id, c.zone]));
const classifyKey = Object.fromEntries(CLASSIFY_CARDS.map((c) => [c.id, c.zone]));
const discoverKey = Object.fromEntries(CONDITIONS.map((c) => [c.key, c.key]));
const outfitsKey = Object.fromEntries(OUTFITS.map((o) => [o.id, o.suitable ? 1 : 0]));
const threeKey = Object.fromEntries(THREE_SITUATIONS.map((s) => [s.key, s.correct]));
const taharaKey = Object.fromEntries(TAHARA_QUESTIONS.map((s) => [s.key, s.correct]));
const championKey = Object.fromEntries(CHAMPION_LEVELS.map((l) => [l.key, l.correct]));

export const ACTIVITIES: Record<string, ActivityDef> = {
  intro_predict: {
    slideKey: "intro",
    title: "التوقع: ما الذي أتأكد منه قبل الصلاة؟",
    kind: "brainstorm",
    required: true,
    maxScore: 1,
    grade: participationGrade,
  },
  intro_brainstorm: {
    slideKey: "intro",
    title: "العصف الذهني (كتابي/صوتي)",
    kind: "open",
    required: false,
    maxScore: 1,
    grade: participationGrade,
  },
  discover_flip: {
    slideKey: "discover",
    title: "اكتشاف البطاقات الست",
    kind: "explore",
    required: false,
    maxScore: 1,
    grade: participationGrade,
  },
  discover_match: {
    slideKey: "discover",
    title: "مطابقة الشرط بمعناه",
    kind: "match",
    required: true,
    maxScore: 6,
    grade: (a) => mapGrade(a, discoverKey),
  },
  three_situations: {
    slideKey: "three",
    title: "مواقف الإسلام والتمييز والعقل",
    kind: "situations",
    required: true,
    maxScore: 3,
    grade: (a) => multiChoiceGrade(a, threeKey),
  },
  three_age: {
    slideKey: "three",
    title: "سن التمييز",
    kind: "mcq",
    required: true,
    maxScore: 1,
    grade: (a) => choiceGrade(a, AGE_QUESTION.correct),
  },
  tahara_quiz: {
    slideKey: "tahara",
    title: "شاهد وفكر وأجب – الطهارة",
    kind: "mcq",
    required: true,
    maxScore: 3,
    grade: (a) => multiChoiceGrade(a, taharaKey),
  },
  najasa_dragdrop: {
    slideKey: "najasa",
    title: "مواضع إزالة النجاسة (سحب وإفلات)",
    kind: "dragdrop",
    required: true,
    maxScore: 6,
    grade: (a) => mapGrade(a, najasaKey),
  },
  detective_case_1: {
    slideKey: "detective",
    title: "القضية الأولى",
    kind: "case",
    required: true,
    maxScore: 1,
    grade: (a) => {
      const r = multiChoiceGrade(a, { where: DETECTIVE_CASES[0].whereCorrect, fix: DETECTIVE_CASES[0].fixCorrect });
      return { ...r, score: r.isCorrect ? 1 : 0, maxScore: 1 };
    },
  },
  detective_case_2: {
    slideKey: "detective",
    title: "القضية الثانية",
    kind: "case",
    required: true,
    maxScore: 1,
    grade: (a) => {
      const r = multiChoiceGrade(a, { where: DETECTIVE_CASES[1].whereCorrect, fix: DETECTIVE_CASES[1].fixCorrect });
      return { ...r, score: r.isCorrect ? 1 : 0, maxScore: 1 };
    },
  },
  detective_case_3: {
    slideKey: "detective",
    title: "القضية الثالثة",
    kind: "case",
    required: true,
    maxScore: 1,
    grade: (a) => {
      const r = multiChoiceGrade(a, { where: DETECTIVE_CASES[2].whereCorrect, fix: DETECTIVE_CASES[2].fixCorrect });
      return { ...r, score: r.isCorrect ? 1 : 0, maxScore: 1 };
    },
  },
  awrah_rules: {
    slideKey: "awrah",
    title: "قاعدتا عورة الرجل والمرأة",
    kind: "fill",
    required: true,
    maxScore: 2,
    grade: (a) => multiChoiceGrade(a, { man: 0, woman: 0 }),
  },
  awrah_outfits: {
    slideKey: "awrah",
    title: "تمييز اللباس المناسب للصلاة",
    kind: "sort",
    required: true,
    maxScore: 4,
    grade: (a) => multiChoiceGrade(a, outfitsKey),
  },
  ayah_order: {
    slideKey: "ayah",
    title: "ترتيب كلمات الآية",
    kind: "order",
    required: true,
    maxScore: 1,
    grade: (a) => orderGrade(a, EVIDENCE.ayah.words),
  },
  ayah_relation: {
    slideKey: "ayah",
    title: "العلاقة بين الآية وستر العورة",
    kind: "mcq",
    required: true,
    maxScore: 1,
    grade: (a) => choiceGrade(a, AYAH_RELATION.correct),
  },
  ayah_recite: {
    slideKey: "ayah",
    title: "تسجيل قراءة الآية (اختياري)",
    kind: "audio",
    required: false,
    maxScore: 1,
    grade: participationGrade,
  },
  classify_cases: {
    slideKey: "classify",
    title: "تصنيف المواقف تحت الشروط",
    kind: "classify",
    required: true,
    maxScore: 8,
    grade: (a) => mapGrade(a, classifyKey),
  },
  champion_game: {
    slideKey: "champion",
    title: "لعبة بطل شروط الصلاة",
    kind: "game",
    required: true,
    maxScore: 6,
    grade: (a) => multiChoiceGrade(a, championKey),
  },
};

export const AWRAH_RULE_CHOICES = {
  man: ["من السرة إلى الركبة", "من الكتف إلى القدم", "الوجه والكفان فقط"],
  woman: ["تغطي كامل جسدها ما عدا وجهها وكفيها", "من السرة إلى الركبة", "تغطي نصف جسدها"],
};

/** الأنشطة الإلزامية خارج أسئلة قاعدة البيانات */
export const REQUIRED_ACTIVITY_KEYS = Object.entries(ACTIVITIES)
  .filter(([, a]) => a.required)
  .map(([k]) => k);

export const ACHIEVEMENT_DEFS: Record<string, { title: string; icon: string }> = {
  starter: { title: "بداية موفقة", icon: "🚀" },
  discoverer: { title: "المكتشف الصغير", icon: "🔎" },
  detective: { title: "المحقق الذكي", icon: "🕵️" },
  reciter: { title: "حافظ الآية", icon: "📖" },
  quiz_passed: { title: "اجتاز التقويم", icon: "🎯" },
  champion: { title: "بطل شروط الصلاة", icon: "🏆" },
};

export const SKILLS = [
  "الإسلام والتمييز والعقل",
  "الطهارة",
  "إزالة النجاسة",
  "ستر العورة",
  "الاستنتاج",
];

export const BRAINSTORM_CHIPS = [
  "الوضوء (الطهارة)",
  "نظافة الملابس من النجاسة",
  "ستر العورة",
  "مكان صلاة طاهر",
  "أن أكون مسلمًا",
  "مشاهدة التلفاز",
  "تناول الحلوى",
];
