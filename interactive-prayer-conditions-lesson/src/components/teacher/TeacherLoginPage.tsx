"use client";

import { useRouter } from "next/navigation";
import { withTokens } from "@/lib/client-auth";
import { TeacherLoginInline } from "./TeacherApp";

export default function TeacherLoginPage() {
  const router = useRouter();
  return (
    <main className="pattern-bg grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md">
        <TeacherLoginInline onLogin={() => router.push(withTokens("/teacher"))} />
      </div>
    </main>
  );
}
