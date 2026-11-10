import { NextRequest, NextResponse } from "next/server";

/**
 * دعم CORS لعرض الموقع داخل إطارات (iframe) مقيّدة بـ sandbox:
 * عند غياب allow-same-origin يصبح أصل المستند `null`، وتحتاج كل طلبات fetch
 * (بما فيها طلبات RSC الخاصة بـ Next.js وطلبات API التي تحمل Authorization)
 * إلى ردّ preflight صالح. نُضيف الترويسات لكل الردود ونردّ على OPTIONS بـ 204.
 *
 * المصادقة تعتمد على رمز Bearer لا على الكوكيز، فالسماح بالأصول المختلفة آمن هنا.
 */

const DEFAULT_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-Student-Token",
  "X-Teacher-Token",
  "X-Requested-With",
  "Accept",
  "Cache-Control",
  "RSC",
  "Next-Router-State-Tree",
  "Next-Router-Prefetch",
  "Next-Router-Segment-Prefetch",
  "Next-Url",
  "Next-Action",
  "Next-Action-Id",
  "X-Nextjs-Request-Id",
  "X-Forwarded-Host",
  "X-Forwarded-Proto",
].join(", ");

const DEFAULT_METHODS = "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS";

function corsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin") ?? "*";
  const requested = request.headers.get("access-control-request-headers");
  const requestedMethod = request.headers.get("access-control-request-method");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": requestedMethod
      ? `${DEFAULT_METHODS}, ${requestedMethod.toUpperCase()}`
      : DEFAULT_METHODS,
    "Access-Control-Allow-Headers": requested
      ? `${DEFAULT_HEADERS}, ${requested}`
      : DEFAULT_HEADERS,
    "Access-Control-Expose-Headers": "Content-Disposition, Content-Type, Content-Length, X-Frame-Options",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
  };
  if (request.headers.get("access-control-request-private-network")) {
    headers["Access-Control-Allow-Private-Network"] = "true";
  }
  return headers;
}

export function proxy(request: NextRequest) {
  const headers = corsHeaders(request);

  // ردّ فحص CORS المسبق (preflight) قبل أي معالجة
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}

export default proxy;

export const config = {
  matcher: ["/:path*"],
};
