import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

/** المصادقة تتم في واجهة العميل عبر رمز مُوقّع (لا يعتمد على الكوكيز) */
export default function TeacherLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
