import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // لا نعتمد على مُحسّن الصور: تُخدم الرسوم مباشرة من public (webp مع بديل png)،
  // وهذا يمنع اختفاء الصور خلف بروكسيات المعاينة أو عند اختلاف إعدادات النشر.
  images: { unoptimized: true },

};

export default nextConfig;
