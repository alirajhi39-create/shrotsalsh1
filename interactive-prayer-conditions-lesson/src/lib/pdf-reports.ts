import pdfmake from "pdfmake-rtl/js/index.js";
import { CAIRO_REGULAR_BASE64, CAIRO_BOLD_BASE64 } from "./pdf-fonts";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { questions, quizAttempts, studentAnswers, teachers } from "@/db/schema";
import { LESSON, SLIDES } from "./content";
import { humanizeResponse } from "./grading";
import { isStruggling, loadTeacherData, type StudentRow } from "./teacher-data";

let fontsReady=false;
function fonts(){if(!fontsReady){pdfmake.virtualfs.writeFileSync("Cairo-Regular.ttf",Buffer.from(CAIRO_REGULAR_BASE64,"base64"));pdfmake.virtualfs.writeFileSync("Cairo-Bold.ttf",Buffer.from(CAIRO_BOLD_BASE64,"base64"));pdfmake.addFonts({Cairo:{normal:"Cairo-Regular.ttf",bold:"Cairo-Bold.ttf",italics:"Cairo-Regular.ttf",bolditalics:"Cairo-Bold.ttf"}});fontsReady=true;}}
const months=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];const date=(d:Date|string|null)=>{if(!d)return "—";const x=new Date(d);return `${x.getUTCDate()} ${months[x.getUTCMonth()]} ${x.getUTCFullYear()}`;};
const pct=(n:number|null)=>n===null?"—":`${Math.round(n)}%`;
function status(s:StudentRow,pass:number){if(s.certificateSerial)return"شهادة";if(s.pendingReview)return"بانتظار التصحيح";if(s.currentSlide===null)return"لم يبدأ";return isStruggling(s,pass)?"يحتاج متابعة":"مستمر";}
function header(subtitle:string){return [{text:LESSON.school,fontSize:10,color:"#52656a"},{text:subtitle.startsWith("تقرير فردي")?"تقرير نتائج الطالب":"تقرير نتائج الطلاب",fontSize:23,bold:true,color:"#174a4b",margin:[0,5,0,4]},{text:`${LESSON.title.replace("(1)","— الجزء الأول")} — ${LESSON.subject} — ${LESSON.grade}`,fontSize:11,color:"#176f70"},{text:subtitle,fontSize:11,bold:true,margin:[0,7,0,5]},{text:`تاريخ إصدار التقرير: ${date(new Date())}`,fontSize:9,color:"#64748b",margin:[0,0,0,14]}];}
function table(body:unknown[][],widths:(string|number)[],headerRows=1){return {table:{headerRows,widths,body,dontBreakRows:true},layout:{fillColor:(row:number)=>row<headerRows?"#178b8b":row%2===0?"#f1fafa":"#ffffff",hLineColor:()=> "#d7e8e8",vLineColor:()=> "#d7e8e8",paddingTop:()=>5,paddingBottom:()=>5},fontSize:9,margin:[0,0,0,14]};}
const th=(text:string)=>({text,bold:true,color:"#ffffff",alignment:"right"});
function base(content:unknown[],landscape:boolean,title:string){fonts();return {pageSize:"A4",pageOrientation:landscape?"landscape":"portrait",pageMargins:[34,28,34,38],rtl:true,info:{title,author:LESSON.teacher,subject:LESSON.title},defaultStyle:{font:"Cairo",fontSize:10,alignment:"right",color:"#17343a"},styles:{section:{fontSize:14,bold:true,color:"#176f70",margin:[0,10,0,8]}},footer:(current:number,count:number)=>({text:`${LESSON.school} — صفحة ${current} من ${count}`,alignment:"center",fontSize:8,color:"#64748b"}),content};}

export async function buildClassReport(teacherId:number,classroomId?:number){
  const data=await loadTeacherData(teacherId);const [teacher]=await db.select().from(teachers).where(eq(teachers.id,teacherId)).limit(1);
  const room=data.rooms.find(r=>r.id===classroomId);if(classroomId&&!room)throw new Error("الفصل غير موجود");
  const list=data.students.filter(s=>!classroomId||s.classroomId===classroomId);
  const attempted=list.filter(s=>s.bestPercent!==null);const avg=attempted.length?attempted.reduce((a,s)=>a+(s.bestPercent??0),0)/attempted.length:0;
  const content:unknown[]=[...header(`${room?`الفصل: ${room.name}`:"جميع الفصول"} — المعلم: ${teacher?.name??LESSON.teacher}`),
    table([[th("الطلاب"),th("بدؤوا الدرس"),th("أكملوا الدرس"),th("متوسط الاختبار"),th("نسبة الاجتياز"),th("بانتظار التصحيح")],[String(list.length),String(list.filter(s=>s.currentSlide!==null).length),String(list.filter(s=>s.completedAt).length),pct(attempted.length?avg:null),pct(attempted.length?attempted.filter(s=>(s.bestPercent??0)>=data.passPercent).length/attempted.length*100:null),String(list.filter(s=>s.pendingReview).length)]],["*","*","*","*","*","*"]),
    {text:`نسبة النجاح المعتمدة: ${data.passPercent}% — النتائج من قاعدة بيانات الدرس الفعلية.`,fontSize:9,color:"#64748b",margin:[0,0,0,10]},
    table([[th("الطالب"),th("الفصل"),th("الإكمال"),th("أفضل نتيجة"),th("المحاولات"),th("النقاط"),th("الحالة"),th("آخر نشاط")],...list.map(s=>[s.name,s.classroom,`${s.completedSlides.length}/${SLIDES.length}`,pct(s.bestPercent),String(s.attempts),String(s.points),status(s,data.passPercent),date(s.updatedAt)])],["*",72,52,62,50,45,82,70]),
    {text:"ملاحظة: النسبة النهائية للأسئلة الكتابية لا تكتمل حتى يعتمدها المعلم. علامة «—» تعني عدم وجود محاولة اختبار بعد.",fontSize:9,color:"#9a5b13"}];
  if(!list.length)content.splice(3,0,{text:"لا يوجد طلاب مسجلون في هذا النطاق حاليًا.",bold:true,color:"#64748b"});
  return pdfmake.createPdf(base(content,true,`تقرير نتائج ${room?.name??"جميع الفصول"}`)).getBuffer();
}

export async function buildStudentReport(teacherId:number,studentId:number){
  const data=await loadTeacherData(teacherId);const s=data.students.find(x=>x.id===studentId);if(!s)throw new Error("الطالب غير موجود");
  const [attempts,answers,qs,teacherRows]=await Promise.all([
    db.select().from(quizAttempts).where(and(eq(quizAttempts.studentId,studentId),eq(quizAttempts.lessonId,data.lessonId))).orderBy(asc(quizAttempts.attemptNumber)),
    db.select().from(studentAnswers).where(and(eq(studentAnswers.studentId,studentId),eq(studentAnswers.lessonId,data.lessonId))).orderBy(asc(studentAnswers.createdAt)),
    db.select().from(questions).where(eq(questions.lessonId,data.lessonId)),
    db.select().from(teachers).where(eq(teachers.id,teacherId)).limit(1),
  ]);
  const teacher=teacherRows[0];
  const qmap=new Map(qs.map(q=>[q.id,q]));const best=attempts.length?attempts.reduce((a,b)=>a.percent>=b.percent?a:b):null;
  const content:unknown[]=[...header(`تقرير فردي — المعلم: ${teacher?.name??LESSON.teacher}`),
    table([[th("اسم الطالب"),th("الفصل"),th("تاريخ التسجيل"),th("الحالة")],[s.name,s.classroom,date(s.createdAt),status(s,data.passPercent)]],["*",80,90,100]),
    {text:"ملخص التقدم والأداء",style:"section"},
    table([[th("المحطات المكتملة"),th("نسبة الإكمال"),th("أفضل نتيجة"),th("النقاط"),th("النجوم"),th("الشهادة")],[`${s.completedSlides.length}/${SLIDES.length}`,`${s.completionPct}%`,pct(s.bestPercent),String(s.points),String(s.stars),s.certificateSerial??"لم تصدر"]],["*","*","*","*","*","*"]),
    {text:"محاولات التقويم الختامي",style:"section"},
  ];
  content.push(attempts.length?table([[th("المحاولة"),th("الدرجة الآلية"),th("الكتابي"),th("النسبة"),th("الحالة"),th("التاريخ")],...attempts.map(a=>[String(a.attemptNumber),`${a.autoScore}/${a.maxAutoScore}`,`${a.teacherScore}/${a.maxTeacherScore}`,pct(a.percent),a.pendingReview?"بانتظار التصحيح":"مكتملة التصحيح",date(a.submittedAt)])],["*","*","*","*","*","*"]):{text:"لم يؤدِّ الطالب التقويم الختامي بعد.",color:"#64748b"});
  if(best){content.push({text:"تقرير المهارات في أفضل محاولة",style:"section"});content.push(table([[th("المهارة"),th("الدرجة"),th("النسبة"),th("التوصية")],...Object.entries(best.skillReport).map(([skill,v])=>[skill,`${v.earned}/${v.max}`,pct(v.max?v.earned/v.max*100:null),v.max&&v.earned/v.max<0.7?"تحتاج مراجعة":"جيد"])],["*",70,70,110]));}
  content.push({text:"المحطات المكتملة",style:"section"},{text:SLIDES.filter(x=>s.completedSlides.includes(x.key)).map((x,i)=>`${i+1}. ${x.title}`).join("  •  ")||"لم يكمل الطالب محطات بعد.",fontSize:10,margin:[0,0,0,10]});
  const written=answers.filter(a=>a.needsReview);
  if(written.length){content.push({text:"الإجابات الكتابية وتصحيح المعلم",style:"section"});for(const a of written){const q=a.questionId?qmap.get(a.questionId):undefined;content.push({text:q?.prompt??`سؤال #${a.questionId}`,bold:true,fontSize:10,margin:[0,5,0,3]},{text:`الإجابة: ${q?humanizeResponse(q.kind,q.options,a.answer):String(a.answer)}`,fontSize:9,margin:[0,0,0,3]},{text:a.teacherScore===null?"الحالة: بانتظار تصحيح المعلم":`درجة المعلم: ${a.teacherScore}/${a.maxScore}${a.teacherFeedback?` — ${a.teacherFeedback}`:""}`,fontSize:9,color:a.teacherScore===null?"#9a5b13":"#166534",margin:[0,0,0,7]});}}
  content.push({text:"هذا التقرير مخصص للمعلم وليست شهادة اجتياز. الشهادة تصدر فقط بعد استيفاء شروط الدرس.",fontSize:8,color:"#64748b",margin:[0,12,0,0]});
  return pdfmake.createPdf(base(content,false,`تقرير الطالب ${s.name}`)).getBuffer();
}
