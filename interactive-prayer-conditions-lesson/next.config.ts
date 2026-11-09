import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // نخدم الصور التعليمية مباشرة من public/images دون الاعتماد على مُحسّن الصور.
  // هذا يمنع اختفاءها عند اختلاف بيئة النشر أو عند الطباعة وعلى المتصفحات المدمجة.
  images: { unoptimized: true },
  async headers() {
    return [
      {
        // لا نسمح بتسريب معامل الجلسة الاحتياطي في ترويسة Referer
        source: "/teacher/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
