"use client";

import { useMemo, useState } from "react";
import { activityRulesCatalog, resolveActivityRules, type ActivityRules } from "@/lib/activity-rules";
import { Btn } from "@/components/lesson/ui";

export default function ActivityRulesSettings({
  allowSkip,
  activityRules,
  onSave,
  busy,
}: {
  allowSkip: boolean;
  activityRules: ActivityRules;
  onSave: (rules: ActivityRules, allowSkip: boolean) => Promise<boolean>;
  busy: boolean;
}) {
  const catalog = useMemo(() => activityRulesCatalog(), []);
  const [rules, setRules] = useState<ActivityRules>(() => resolveActivityRules(activityRules));
  const [skip, setSkip] = useState(allowSkip);
  const [saving, setSaving] = useState(false);
  const groups = useMemo(() => {
    const map = new Map<string, typeof catalog>();
    for (const item of catalog) map.set(item.slideTitle, [...(map.get(item.slideTitle) ?? []), item]);
    return Array.from(map.entries());
  }, [catalog]);
  const requiredCount = Object.values(rules).filter((rule) => rule.required).length;

  return <section className="rounded-3xl bg-white p-5 shadow">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-turq-900">📋 الأنشطة: إلزامي أم اختياري</h2><p className="mt-1 text-sm text-slate-500">الأنشطة الإلزامية مطلوبة لإكمال المحطة وإصدار الشهادة. الاختيارية لا تمنع التقدم. التخطي يسمح بالمتابعة والعودة لاحقًا لكنه لا يلغي شرط الشهادة للنشاط الإلزامي.</p></div><span className="rounded-full bg-turq-100 px-3 py-1 text-sm font-black text-turq-800">{requiredCount} نشاط إلزامي</span></div>
    <label className="mb-4 flex items-center gap-3 rounded-2xl bg-sky-50 p-3 font-bold text-sky-900"><input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} className="h-5 w-5" /> السماح للطالب بتخطي المحطة غير المحلولة والعودة إليها لاحقًا</label>
    <div className="space-y-4">{groups.map(([title, items]) => <div key={title} className="rounded-2xl border border-slate-200 p-3"><h3 className="mb-2 font-black text-turq-800">{title}</h3><div className="grid gap-2 md:grid-cols-2">{items.map((item) => <label key={item.key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-2 text-sm"><span className="font-bold text-slate-700">{item.title}</span><select value={rules[item.key]?.required ? "required" : "optional"} onChange={(e) => setRules((prev) => ({ ...prev, [item.key]: { required: e.target.value === "required" } }))} className="rounded-lg border-2 border-slate-200 bg-white p-1 font-bold"><option value="required">إلزامي</option><option value="optional">اختياري</option></select></label>)}</div></div>)}</div>
    <div className="mt-4 flex flex-wrap gap-2"><Btn disabled={busy || saving} onClick={async () => { setSaving(true); await onSave(rules, skip); setSaving(false); }}>{saving ? "جارٍ الحفظ…" : "حفظ إعدادات الأنشطة"}</Btn><Btn variant="secondary" disabled={busy || saving} onClick={() => { setRules(resolveActivityRules(null)); setSkip(true); }}>استعادة الافتراضي</Btn></div>
  </section>;
}
