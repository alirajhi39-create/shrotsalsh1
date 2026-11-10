import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBearerToken } from "@/lib/auth";
import { LiveQuizError, submitLiveAnswer } from "@/lib/live-quiz-server";
export const dynamic="force-dynamic";
const schema=z.object({roundIndex:z.number().int().min(0).max(50),optionId:z.string().min(1).max(64)});
export async function POST(req:NextRequest){const token=readBearerToken(req.headers);if(!token)return NextResponse.json({error:"انضم إلى المسابقة أولًا"},{status:401});const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:"إجابة غير صالحة"},{status:400});try{return NextResponse.json({ok:true,...await submitLiveAnswer(token,p.data.roundIndex,p.data.optionId)});}catch(e){return NextResponse.json({error:e instanceof LiveQuizError?e.message:"تعذر حفظ الإجابة"},{status:e instanceof LiveQuizError?e.status:500});}}
