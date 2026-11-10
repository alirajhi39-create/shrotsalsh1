import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classrooms } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const rows = await db
    .select({ id: classrooms.id, name: classrooms.name })
    .from(classrooms)
    .where(eq(classrooms.active, true))
    .orderBy(asc(classrooms.name));
  return NextResponse.json({ classrooms: rows });
}
