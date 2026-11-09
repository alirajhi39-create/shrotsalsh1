import { NextRequest, NextResponse } from "next/server";

/**
 * مسار احتياطي للجلسات عندما يحجب المتصفح الكوكيز (خاصة داخل iframe):
 * إذا احتوى الرابط على معامل auth، ننقله إلى ترويسة Authorization للطلب الداخلي فقط.
 * لا يتم قبول أي رمز هنا؛ التحقق من التوقيع والصلاحية يتم في getTeacherSession().
 */
export function proxy(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("auth");
  if (!token) return NextResponse.next();

  const requestHeaders = new Headers(req.headers);
  if (!requestHeaders.has("authorization")) {
    requestHeaders.set("authorization", `Bearer ${token}`);
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/teacher/:path*", "/api/teacher/:path*"],
};
