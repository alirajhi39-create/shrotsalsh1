import { NextRequest, NextResponse } from "next/server";
import { readBearerToken } from "@/lib/auth";
import { LiveQuizError, getPlayerState } from "@/lib/live-quiz-server";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){const token=readBearerToken(req.headers);if(!token)return NextResponse.json({error:"انضم إلى المسابقة أولًا"},{status:401});try{return NextResponse.json({ok:true,state:await getPlayerState(token)},{headers:{"Cache-Control":"no-store"}});}catch(e){return NextResponse.json({error:e instanceof LiveQuizError?e.message:"تعذر تحميل المسابقة"},{status:e instanceof LiveQuizError?e.status:500});}}
