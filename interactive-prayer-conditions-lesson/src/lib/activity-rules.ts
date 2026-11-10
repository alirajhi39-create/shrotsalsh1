import { ACTIVITIES, SLIDES } from "./content";

export type ActivityRules = Record<string, { required: boolean }>;

/** الأنشطة الخاصة التي لا تمثل نشاطًا واحدًا في خريطة ACTIVITIES. */
export const SPECIAL_ACTIVITY_RULES = [
  { key: "book_questions", title: "أسئلة نشاط الكتاب المدرسي", slideKey: "book", defaultRequired: true },
] as const;

export function resolveActivityRules(overrides?: ActivityRules | null): ActivityRules {
  const rules: ActivityRules = {};
  for (const [key, activity] of Object.entries(ACTIVITIES)) {
    rules[key] = { required: overrides?.[key]?.required ?? activity.required };
  }
  for (const special of SPECIAL_ACTIVITY_RULES) {
    rules[special.key] = { required: overrides?.[special.key]?.required ?? special.defaultRequired };
  }
  return rules;
}

export function isActivityRequired(key: string, rules?: ActivityRules | null): boolean {
  return resolveActivityRules(rules)[key]?.required ?? false;
}

export function requiredActivityKeys(rules?: ActivityRules | null): string[] {
  return Object.entries(resolveActivityRules(rules))
    .filter(([key, rule]) => rule.required && key in ACTIVITIES)
    .map(([key]) => key);
}

export function activityRulesCatalog() {
  return [
    ...Object.entries(ACTIVITIES).map(([key, activity]) => ({
      key,
      title: activity.title,
      slideKey: activity.slideKey as string,
      slideTitle: SLIDES.find((slide) => slide.key === activity.slideKey)?.title ?? activity.slideKey,
      defaultRequired: activity.required,
    })),
    ...SPECIAL_ACTIVITY_RULES.map((special) => ({
      key: special.key as string,
      title: special.title,
      slideKey: special.slideKey as string,
      slideTitle: SLIDES.find((slide) => slide.key === special.slideKey)?.title ?? special.slideKey,
      defaultRequired: special.defaultRequired as boolean,
    })),
  ];
}
