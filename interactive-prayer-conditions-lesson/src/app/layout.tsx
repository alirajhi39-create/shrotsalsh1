import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import LessonMediaProvider from "@/components/lesson/LessonMediaProvider";
import { getPublishedMedia } from "@/lib/media-server";
import { EMPTY_MEDIA } from "@/lib/media";
import "./globals.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "شروط الصلاة (1) – درس تفاعلي | الصف الثالث الابتدائي",
  description: "رحلة تعليمية تفاعلية من 12 محطة لدرس شروط الصلاة (1) – الدراسات الإسلامية (الفقه) – الصف الثالث الابتدائي – مدرسة العروس الابتدائية.",
  applicationName: "شروط الصلاة (1)",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1fadab" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const media = await getPublishedMedia().catch(() => EMPTY_MEDIA);
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Amiri:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <LessonMediaProvider initial={media}>{children}</LessonMediaProvider>
      </body>
    </html>
  );
}
