import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { LiveQuizError, joinLiveRoom } from "@/lib/live-quiz-server";
export const dynamic="force-dynamic";
const schema=z.object({code:z.string().trim().min(6).max(8),name:z.string().trim().min(2,"اكتب اسمك").max(40)});
export async function POST(req:NextRequest){const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:p.error.issues[0]?.message??"بيانات غير صالحة"},{status:400});try{return NextResponse.json({ok:true,...await joinLiveRoom(p.data.code,p.data.name)});}catch(e){return NextResponse.json({error:e instanceof LiveQuizError?e.message:"تعذر الانضمام"},{status:e instanceof LiveQuizError?e.status:500});}}
