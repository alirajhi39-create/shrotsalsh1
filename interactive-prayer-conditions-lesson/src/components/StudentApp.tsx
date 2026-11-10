"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getStudentToken } from "@/lib/client-auth";
import StudentEntry from "./StudentEntry";
import Journey from "./lesson/Journey";

type Classroom = { id: number; name: string };
type Current = { id: number; name: string; classroom: string } | null;

/**
 * تطبيق الطالب في صفحة واحدة: لا يحدث أي انتقال بين المسارات بعد الدخول،
 * فلا تُفقد الجلسة داخل إطارات المعاينة التي تحجب الكوكيز/التخزين.
 * يُعرض الدرس عبر Portal على document.body حتى لا تحبسه حركة transform
 * الموجودة في عمود صفحة الاستقبال داخل نطاق ضيق.
 */
export default function StudentApp({
  classrooms,
  current,
  initialStarted = false,
}: {
  classrooms: Classroom[];
  current: Current;
  initialStarted?: boolean;
}) {
  const [started, setStarted] = useState<boolean>(initialStarted || !!current);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // استئناف تلقائي بعد تحديث الصفحة إذا كان رمز الجلسة موجودًا في الرابط/التخزين
  useEffect(() => {
    if (!started && getStudentToken()) setStarted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lesson = (
    <div data-scroll-root className="fixed inset-0 z-[60] overflow-y-auto overflow-x-hidden bg-[#f4fbfb]">
      <Journey onUnauthorized={() => setStarted(false)} />
    </div>
  );

  if (!started) {
    return <StudentEntry classrooms={classrooms} current={current} onStart={() => setStarted(true)} />;
  }

  return mounted && typeof document !== "undefined" ? createPortal(lesson, document.body) : lesson;
}
