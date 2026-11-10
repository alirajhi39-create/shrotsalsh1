import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { teacherSessionFromRequest } from "@/lib/auth";
import { LiveQuizError, getHostState, hostAction } from "@/lib/live-quiz-server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{code:string}>};
const schema=z.discriminatedUnion("action",[z.object({action:z.enum(["start","reveal","next","end"])}),z.object({action:z.literal("kick"),playerId:z.number().int().positive()})]);
export async function GET(req:NextRequest,ctx:Ctx){const t=await teacherSessionFromRequest(req);if(!t)return NextResponse.json({error:"غير مصرح"},{status:401});try{return NextResponse.json({ok:true,state:await getHostState(t.teacherId,(await ctx.params).code)},{headers:{"Cache-Control":"no-store"}});}catch(e){return NextResponse.json({error:e instanceof LiveQuizError?e.message:"الغرفة غير موجودة"},{status:e instanceof LiveQuizError?e.status:500});}}
export async function POST(req:NextRequest,ctx:Ctx){const t=await teacherSessionFromRequest(req);if(!t)return NextResponse.json({error:"غير مصرح"},{status:401});const p=schema.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({error:"أمر غير صالح"},{status:400});try{const state=await hostAction(t.teacherId,(await ctx.params).code,p.data.action,p.data.action==="kick"?p.data.playerId:undefined);return NextResponse.json({ok:true,state});}catch(e){return NextResponse.json({error:e instanceof LiveQuizError?e.message:"تعذر تنفيذ الأمر"},{status:e instanceof LiveQuizError?e.status:500});}}
