import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { teacherSessionFromRequest } from "@/lib/auth";
import { LiveQuizError, createLiveRoom, listLiveRooms } from "@/lib/live-quiz-server";
export const dynamic="force-dynamic";
const schema=z.object({mode:z.enum(["mixed","assessment","conditions","najasa"]).default("mixed"),questionSeconds:z.number().int().min(10).max(120).default(30),questionCount:z.number().int().min(5).max(50).optional()});
export async function GET(req:NextRequest){const t=await teacherSessionFromRequest(req);if(!t)return NextResponse.json({error:"غير مصرح"},{status:401});return NextResponse.json({ok:true,rooms:await listLiveRooms(t.teacherId)});}
export async function POST(req:NextRequest){const t=await teacherSessionFromRequest(req);if(!t)return NextResponse.json({error:"غير مصرح"},{status:401});const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:"إعدادات المسابقة غير صالحة"},{status:400});try{return NextResponse.json({ok:true,state:await createLiveRoom(t.teacherId,p.data.mode,p.data.questionSeconds,p.data.questionCount)});}catch(e){return NextResponse.json({error:e instanceof LiveQuizError?e.message:"تعذر إنشاء الغرفة"},{status:e instanceof LiveQuizError?e.status:500});}}
