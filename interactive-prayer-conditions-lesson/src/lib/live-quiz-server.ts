import { randomInt } from "crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { liveQuizAnswers, liveQuizPlayers, liveQuizRooms, questions as questionBank, type LiveQuizRoom } from "@/db/schema";
import { generateResumeCode, generateToken, hashToken } from "./auth";
import { ensureSeeded } from "./seed";
import { AGE_QUESTION, AWRAH_RULE_CHOICES, AYAH_RELATION, CHAMPION_LEVELS, CLASSIFY_CARDS, CONDITIONS, DETECTIVE_CASES, NAJASA_CARDS, NAJASA_PLACES, OUTFITS, TAHARA_QUESTIONS, THREE_SITUATIONS } from "./content";
import { logAudit } from "./student";
import type { LiveHostState, LiveLeader, LiveMode, LivePlayerState, LiveQuestion, LiveStatus } from "./live-quiz";

export class LiveQuizError extends Error { constructor(message: string, public status = 400) { super(message); } }
const normalizeCode = (code: string) => code.trim().toUpperCase();
const normalizeName = (name: string) => name.replace(/\s+/g, " ").trim();
const rowsOf = (result: unknown): Record<string, unknown>[] => {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return ((result as { rows?: Record<string, unknown>[] }).rows ?? []);
};
function shuffled<T>(items: readonly T[]): T[] { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];} return a; }

type BankQuestion = typeof questionBank.$inferSelect;
function fromBank(q: BankQuestion): LiveQuestion | null {
  const source = q.slideKey === "quiz" ? "التقويم الختامي" : "نشاط الكتاب";
  const choices = Array.isArray(q.options.choices) ? (q.options.choices as unknown[]).map(String) : [];
  if (["mcq", "situation", "fill"].includes(q.kind) && choices.length >= 2 && Number.isInteger(Number(q.answer.index))) {
    const index = Number(q.answer.index);
    if (index < 0 || index >= choices.length) return null;
    return { id: `bank-${q.id}`, source, prompt: q.prompt, options: choices.map((label, i) => ({ id: `q${q.id}-o${i}`, label })), correctOptionId: `q${q.id}-o${index}`, explanation: q.explanation };
  }
  if (q.kind === "truefalse" && typeof q.answer.value === "boolean") {
    return { id: `bank-${q.id}`, source, prompt: q.prompt, options: [{ id: "true", label: "صح", emoji: "✅" }, { id: "false", label: "خطأ", emoji: "❌" }], correctOptionId: String(q.answer.value), explanation: q.explanation };
  }
  // الأسئلة المقالية والترتيب والسحب والتصنيف المتعدد تبقى في الدرس/التقويم ولا تتحول إلى تخمين أحادي.
  return null;
}
function choiceQuestion(key: string, prompt: string, choices: readonly string[], correct: number, explanation: string): LiveQuestion {
  return { id: key, source: "أنشطة الدرس", prompt, options: choices.map((label, i) => ({ id: `${key}-o${i}`, label })), correctOptionId: `${key}-o${correct}`, explanation };
}
function conditionQuestions(): LiveQuestion[] {
  const options = CONDITIONS.map((c) => ({ id: c.key, label: c.name, emoji: c.icon }));
  return CLASSIFY_CARDS.map((card) => ({ id: `condition-${card.id}`, source: "تصنيف الشروط", prompt: card.label, options, correctOptionId: card.zone, explanation: `هذا الموقف يدل على شرط ${CONDITIONS.find((c) => c.key === card.zone)?.name}.` }));
}
function najasaQuestions(): LiveQuestion[] {
  const options = NAJASA_PLACES.map((p) => ({ id: p.key, label: p.label, emoji: p.icon }));
  return NAJASA_CARDS.map((card) => ({ id: `najasa-${card.id}`, source: "إزالة النجاسة", prompt: `أين يجب إزالة النجاسة في هذا الموقف: ${card.label}؟`, options, correctOptionId: card.zone, explanation: `الموضع الصحيح هو ${NAJASA_PLACES.find((p) => p.key === card.zone)?.label}. عند إرادة الصلاة تجب إزالة النجاسة عن البدن والملابس ومكان الصلاة.` }));
}
function lessonActivityQuestions(): LiveQuestion[] {
  const out: LiveQuestion[] = [
    choiceQuestion("age", AGE_QUESTION.text, AGE_QUESTION.choices, AGE_QUESTION.correct, AGE_QUESTION.feedback),
    choiceQuestion("ayah", AYAH_RELATION.text, AYAH_RELATION.choices, AYAH_RELATION.correct, "تدل الآية على أخذ الزينة واللباس المناسب عند الصلاة، ومن ذلك ستر العورة."),
    choiceQuestion("awrah-man", "عورة الرجل في الصلاة:", AWRAH_RULE_CHOICES.man, 0, "عورة الرجل في الصلاة من السرة إلى الركبة."),
    choiceQuestion("awrah-woman", "عورة المرأة في الصلاة:", AWRAH_RULE_CHOICES.woman, 0, "عورة المرأة في الصلاة تغطي كامل جسدها ما عدا وجهها وكفيها."),
  ];
  THREE_SITUATIONS.forEach((s) => out.push(choiceQuestion(`three-${s.key}`, s.text, s.choices, s.correct, CONDITIONS.find((c) => c.key === (s.key === "s1" ? "tamyeez" : s.key === "s2" ? "aql" : "islam"))?.text ?? "")));
  TAHARA_QUESTIONS.forEach((q) => out.push(choiceQuestion(`tahara-${q.key}`, q.text, q.choices, q.correct, "الشرط الرابع هو الطهارة؛ فمن أحدث لا تُقبل صلاته حتى يتوضأ.")));
  CHAMPION_LEVELS.forEach((l) => out.push(choiceQuestion(`champion-${l.key}`, l.text, l.choices, l.correct, CONDITIONS.find((c) => c.key === l.key)?.text ?? "")));
  DETECTIVE_CASES.forEach((c) => {
    out.push(choiceQuestion(`detective-${c.key}-where`, `${c.text} أين موضع المشكلة؟`, c.whereChoices, c.whereCorrect, `الموضع: ${c.whereChoices[c.whereCorrect]}.`));
    out.push(choiceQuestion(`detective-${c.key}-fix`, `${c.text} كيف تعالج المشكلة؟`, c.fixChoices, c.fixCorrect, `المعالجة الصحيحة: ${c.fixChoices[c.fixCorrect]}.`));
  });
  OUTFITS.forEach((o) => out.push(choiceQuestion(`outfit-${o.id}`, `${o.who}: ${o.label}. هل هذا اللباس مناسب للصلاة؟`, ["مناسب", "غير مناسب"], o.suitable ? 0 : 1, o.suitable ? "اللباس ساتر للعورة ومناسب للصلاة." : "اللباس لا يستر العورة كما ينبغي في الصلاة.")));
  return out;
}
function dedupeQuestions(items: LiveQuestion[]): LiveQuestion[] {
  const seen = new Set<string>();
  return items.filter((q) => { const key = `${q.prompt.trim()}::${q.options.find((o) => o.id === q.correctOptionId)?.label ?? ""}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
export async function buildLiveQuestionPool(mode: LiveMode, lessonId: number): Promise<LiveQuestion[]> {
  if (mode === "conditions") return dedupeQuestions(conditionQuestions());
  if (mode === "najasa") return dedupeQuestions(najasaQuestions());
  const rows = await db.select().from(questionBank).where(and(eq(questionBank.lessonId, lessonId), eq(questionBank.active, true), inArray(questionBank.slideKey, mode === "assessment" ? ["quiz"] : ["quiz", "book"]))).orderBy(asc(questionBank.orderIndex));
  const bank = rows.map(fromBank).filter((q): q is LiveQuestion => q !== null);
  if (mode === "assessment") {
    if (!bank.length) throw new LiveQuizError("لا توجد أسئلة تقويم موضوعية مفعلة؛ فعّل الأسئلة من لوحة المعلم أولًا");
    return dedupeQuestions(bank);
  }
  return dedupeQuestions([...bank, ...lessonActivityQuestions(), ...conditionQuestions(), ...najasaQuestions()]);
}
export async function buildLiveQuestions(mode: LiveMode, lessonId: number): Promise<LiveQuestion[]> {
  return shuffled(await buildLiveQuestionPool(mode, lessonId));
}
export async function getLiveQuestionChoices(mode: LiveMode) {
  const lessonId = await ensureSeeded();
  const pool = await buildLiveQuestionPool(mode, lessonId);
  return pool.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options, source: q.source ?? "أسئلة الدرس" }));
}


async function roomByCode(code: string, teacherId?: number) {
  const condition = teacherId === undefined ? eq(liveQuizRooms.code, normalizeCode(code)) : and(eq(liveQuizRooms.code, normalizeCode(code)), eq(liveQuizRooms.teacherId, teacherId));
  const [room] = await db.select().from(liveQuizRooms).where(condition).limit(1);
  if (!room) throw new LiveQuizError("رمز المسابقة غير صحيح", 404);
  return room;
}
const timeLeft = (room: LiveQuizRoom) => {
  if (room.status !== "active" || !room.timerEnabled || !room.questionEndsAt) return 0;
  const reference = room.timerPausedAt?.getTime() ?? Date.now();
  return Math.max(0, Math.ceil((room.questionEndsAt.getTime() - reference) / 1000));
};
function publicQuestion(room: LiveQuizRoom, reveal: boolean): LiveQuestion | null {
  const q = room.questions[room.currentRound];
  if (!q) return null;
  return { id: q.id ?? `round-${room.currentRound}`, prompt: q.prompt, options: q.options, ...(reveal ? { correctOptionId: q.correctOptionId, explanation: q.explanation } : {}) };
}

export type CreateLiveRoomOptions = {
  mode: LiveMode;
  questionSeconds: number;
  questionCount?: number;
  timerEnabled?: boolean;
  questionIds?: string[];
  autoReveal?: boolean;
};
export async function createLiveRoom(teacherId: number, options: CreateLiveRoomOptions) {
  const { mode, questionSeconds, questionCount, timerEnabled = true, questionIds, autoReveal = true } = options;
  const lessonId = await ensureSeeded();
  const pool = await buildLiveQuestionPool(mode, lessonId);
  let questions: LiveQuestion[];
  if (questionIds) {
    if (!questionIds.length) throw new LiveQuizError("حدد سؤالًا واحدًا على الأقل للمسابقة");
    const byId = new Map(pool.map((q) => [q.id, q]));
    const missing = questionIds.filter((id) => !byId.has(id));
    if (missing.length) throw new LiveQuizError("بعض الأسئلة المحددة لم تعد متاحة؛ حدّث قائمة الأسئلة واختر من جديد");
    questions = questionIds.map((id) => byId.get(id)!);
  } else {
    const mixed = shuffled(pool);
    questions = questionCount ? mixed.slice(0, Math.max(1, questionCount)) : mixed;
  }
  if (!questions.length) throw new LiveQuizError("لا توجد أسئلة متاحة لهذا النوع");
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateResumeCode(6);
    const [room] = await db.insert(liveQuizRooms).values({ lessonId, teacherId, code, mode, questionSeconds, timerEnabled, autoReveal, questions, expiresAt: new Date(Date.now() + 6 * 3600_000) }).onConflictDoNothing().returning();
    if (room) { await logAudit("teacher", teacherId, "live_quiz_created", "live_quiz_rooms", room.id, { mode }); return getHostState(teacherId, code); }
  }
  throw new LiveQuizError("تعذر إنشاء رمز غرفة؛ حاول مرة أخرى", 500);
}

async function leaderboard(roomId: number): Promise<LiveLeader[]> {
  const players = await db.select().from(liveQuizPlayers).where(eq(liveQuizPlayers.roomId, roomId)).orderBy(asc(liveQuizPlayers.joinedAt));
  const answers = await db.select().from(liveQuizAnswers).where(eq(liveQuizAnswers.roomId, roomId));
  return players.map((p) => { const mine=answers.filter((a)=>a.playerId===p.id); return { id:p.id,name:p.name,score:mine.reduce((s,a)=>s+a.points,0),correct:mine.filter((a)=>a.isCorrect).length,answered:mine.length,rank:0,active:p.active }; })
    .sort((a,b)=>b.score-a.score || b.correct-a.correct || a.id-b.id).map((p,i)=>({...p,rank:i+1}));
}

export async function getHostState(teacherId: number, code: string): Promise<LiveHostState> {
  const room = await roomByCode(code, teacherId);
  const players = await leaderboard(room.id);
  const answers = await db.select().from(liveQuizAnswers).where(and(eq(liveQuizAnswers.roomId, room.id), eq(liveQuizAnswers.roundIndex, room.currentRound)));
  const optionCounts: Record<string, number> = {};
  for (const a of answers) optionCounts[a.optionId] = (optionCounts[a.optionId] ?? 0) + 1;
  const activePlayers = players.filter((p) => p.active);
  const activeIds = new Set(activePlayers.map((p) => p.id));
  const countedAnswers = answers.filter((a) => activeIds.has(a.playerId));
  for (const key of Object.keys(optionCounts)) delete optionCounts[key];
  for (const a of countedAnswers) optionCounts[a.optionId] = (optionCounts[a.optionId] ?? 0) + 1;
  return { code:room.code,mode:room.mode as LiveMode,status:room.status as LiveStatus,currentRound:room.currentRound,totalRounds:room.questions.length,questionSeconds:room.questionSeconds,timerEnabled:room.timerEnabled,timerPaused:!!room.timerPausedAt,autoReveal:room.autoReveal,timeLeft:timeLeft(room),question:publicQuestion(room,room.status==="reveal"||room.status==="ended"),players,playerCount:activePlayers.length,answeredCount:countedAnswers.length,correctCount:countedAnswers.filter((a)=>a.isCorrect).length,wrongCount:countedAnswers.filter((a)=>!a.isCorrect).length,answeredPlayerIds:countedAnswers.map((a)=>a.playerId),optionCounts,joinPath:`/play?room=${room.code}`,expiresAt:room.expiresAt.toISOString() };
}

export async function joinLiveRoom(code: string, rawName: string) {
  await ensureSeeded();
  const name = normalizeName(rawName);
  const room = await roomByCode(code);
  if (room.status !== "lobby") throw new LiveQuizError("بدأت المسابقة؛ انتظر غرفة جديدة من المعلم", 409);
  if (room.expiresAt.getTime() < Date.now()) throw new LiveQuizError("انتهت صلاحية الغرفة", 410);
  const players = await db.select({ id: liveQuizPlayers.id }).from(liveQuizPlayers).where(eq(liveQuizPlayers.roomId, room.id));
  if (players.length >= 100) throw new LiveQuizError("اكتمل عدد لاعبي الغرفة (100)", 409);
  const token = generateToken();
  const [player] = await db.insert(liveQuizPlayers).values({ roomId:room.id,name,nameKey:name.toLocaleLowerCase("ar"),tokenHash:hashToken(token) }).onConflictDoNothing().returning();
  if (!player) throw new LiveQuizError("هذا الاسم مستخدم في الغرفة؛ أضف اسم العائلة أو اختر اسمًا آخر", 409);
  await logAudit("student", null, "live_quiz_joined", "live_quiz_players", player.id, { roomId: room.id });
  return { token, player:{id:player.id,name:player.name}, code:room.code };
}

async function playerByToken(token: string) {
  const [row] = await db.select({ player:liveQuizPlayers,room:liveQuizRooms }).from(liveQuizPlayers).innerJoin(liveQuizRooms,eq(liveQuizRooms.id,liveQuizPlayers.roomId)).where(eq(liveQuizPlayers.tokenHash,hashToken(token))).limit(1);
  if (!row) throw new LiveQuizError("انتهت جلسة اللاعب؛ انضم من جديد", 401);
  if (!row.player.active) throw new LiveQuizError("أخرجك المعلم من الغرفة", 403);
  if (row.room.expiresAt.getTime() < Date.now()) throw new LiveQuizError("انتهت صلاحية الغرفة", 410);
  if (Date.now() - row.player.lastSeenAt.getTime() > 10_000) await db.update(liveQuizPlayers).set({lastSeenAt:new Date()}).where(eq(liveQuizPlayers.id,row.player.id));
  return row;
}

export async function getPlayerState(token: string): Promise<LivePlayerState> {
  const {player,room}=await playerByToken(token);
  const leaders=await leaderboard(room.id);
  const me=leaders.find((p)=>p.id===player.id)!;
  const [answer]=await db.select().from(liveQuizAnswers).where(and(eq(liveQuizAnswers.roomId,room.id),eq(liveQuizAnswers.playerId,player.id),eq(liveQuizAnswers.roundIndex,room.currentRound))).limit(1);
  const reveal=room.status==="reveal"||room.status==="ended";
  return { code:room.code,mode:room.mode as LiveMode,status:room.status as LiveStatus,currentRound:room.currentRound,totalRounds:room.questions.length,questionSeconds:room.questionSeconds,timerEnabled:room.timerEnabled,timerPaused:!!room.timerPausedAt,timeLeft:timeLeft(room),question:publicQuestion(room,reveal),player:{id:player.id,name:player.name,score:me.score,rank:me.rank},ownAnswer:answer?{optionId:answer.optionId,isCorrect:reveal?answer.isCorrect:false,points:reveal?answer.points:0}:null,leaderboard:leaders.filter((p)=>p.active).slice(0,20),expiresAt:room.expiresAt.toISOString() };
}

export async function submitLiveAnswer(token: string, roundIndex: number, optionId: string) {
  const {player,room}=await playerByToken(token);
  const question=room.questions[roundIndex];
  if (!question || !question.options.some((o)=>o.id===optionId)) throw new LiveQuizError("اختيار غير صالح", 400);
  const correct=optionId===question.correctOptionId;
  const result=await db.execute(sql`
    with inserted as (
      insert into live_quiz_answers (room_id, player_id, round_index, option_id, is_correct, points, answered_at)
      select r.id, p.id, ${roundIndex}, ${optionId}, ${correct}, ${correct ? 1 : 0}, now()
      from live_quiz_rooms r join live_quiz_players p on p.room_id=r.id
      where r.id=${room.id} and p.id=${player.id} and p.active=true and r.status='active'
        and r.current_round=${roundIndex} and r.expires_at>now() and r.timer_paused_at is null
        and (r.timer_enabled=false or r.question_ends_at>now())
      on conflict (room_id, player_id, round_index) do nothing
      returning id, is_correct, points
    ), player_count as (
      select count(*)::int as c from live_quiz_players where room_id=${room.id} and active=true
    ), answer_count as (
      select count(*)::int as c from live_quiz_answers a
      join live_quiz_players p on p.id=a.player_id and p.room_id=a.room_id
      where a.room_id=${room.id} and a.round_index=${roundIndex} and p.active=true
    ), auto_revealed as (
      update live_quiz_rooms r set status='reveal', question_ends_at=now(), timer_paused_at=null, updated_at=now()
      where r.id=${room.id} and r.status='active' and r.auto_reveal=true and r.current_round=${roundIndex}
        and exists(select 1 from inserted)
        and (select c from player_count)>0
        and ((select c from answer_count)+(select count(*) from inserted))>=(select c from player_count)
      returning id
    )
    select i.id, i.is_correct, i.points, exists(select 1 from auto_revealed) as auto_revealed from inserted i
  `);
  const inserted=rowsOf(result)[0];
  if (!inserted) {
    const [existing]=await db.select().from(liveQuizAnswers).where(and(eq(liveQuizAnswers.roomId,room.id),eq(liveQuizAnswers.playerId,player.id),eq(liveQuizAnswers.roundIndex,roundIndex))).limit(1);
    if (existing) return { accepted:true,duplicate:true,optionId:existing.optionId,autoRevealed:false };
    throw new LiveQuizError("انتهى وقت السؤال أو انتقل المعلم لسؤال آخر", 409);
  }
  const fallbackRevealed = room.autoReveal ? await revealIfEveryoneAnswered(room.id, roundIndex) : false;
  return { accepted:true,duplicate:false,optionId,autoRevealed:!!inserted.auto_revealed || fallbackRevealed };
}

async function revealIfEveryoneAnswered(roomId: number, roundIndex: number): Promise<boolean> {
  const result = await db.execute(sql`
    update live_quiz_rooms r set status='reveal', question_ends_at=now(), timer_paused_at=null, updated_at=now()
    where r.id=${roomId} and r.status='active' and r.auto_reveal=true and r.current_round=${roundIndex}
      and (select count(*) from live_quiz_players p where p.room_id=r.id and p.active=true)>0
      and (select count(*) from live_quiz_answers a join live_quiz_players p on p.id=a.player_id and p.room_id=a.room_id
           where a.room_id=r.id and a.round_index=${roundIndex} and p.active=true)
          >=(select count(*) from live_quiz_players p where p.room_id=r.id and p.active=true)
    returning id
  `);
  return rowsOf(result).length > 0;
}

export type LiveHostAction = "start"|"reveal"|"next"|"end"|"kick"|"pauseTimer"|"resumeTimer"|"addTime"|"setTimer"|"setAutoReveal";
export async function hostAction(teacherId: number, code: string, action: LiveHostAction, options: { playerId?: number; seconds?: number; enabled?: boolean } = {}) {
  const room=await roomByCode(code,teacherId);
  if (room.expiresAt.getTime()<Date.now()) throw new LiveQuizError("انتهت صلاحية الغرفة؛ أنشئ غرفة جديدة",410);
  const now=new Date(); const ends=new Date(Date.now()+room.questionSeconds*1000);
  const base=and(eq(liveQuizRooms.id,room.id),eq(liveQuizRooms.teacherId,teacherId));
  if (action==="kick") {
    if (!options.playerId) throw new LiveQuizError("حدد اللاعب");
    const [p]=await db.update(liveQuizPlayers).set({active:false}).where(and(eq(liveQuizPlayers.id,options.playerId),eq(liveQuizPlayers.roomId,room.id))).returning({id:liveQuizPlayers.id});
    if(!p) throw new LiveQuizError("اللاعب غير موجود",404);
    await logAudit("teacher",teacherId,"live_quiz_player_removed","live_quiz_players",p.id);
    await revealIfEveryoneAnswered(room.id, room.currentRound);
    return getHostState(teacherId,code);
  }
  let condition; let patch: Partial<typeof liveQuizRooms.$inferInsert>;
  if(action==="start") {
    const players=await db.select({id:liveQuizPlayers.id}).from(liveQuizPlayers).where(and(eq(liveQuizPlayers.roomId,room.id),eq(liveQuizPlayers.active,true))).limit(1);
    if(!players.length) throw new LiveQuizError("انتظر انضمام طالب واحد على الأقل");
    condition=and(base,eq(liveQuizRooms.status,"lobby")); patch={status:"active",currentRound:0,startedAt:now,questionEndsAt:room.timerEnabled?ends:null,timerPausedAt:null,updatedAt:now};
  } else if(action==="reveal") { condition=and(base,eq(liveQuizRooms.status,"active")); patch={status:"reveal",timerPausedAt:null,updatedAt:now}; }
  else if(action==="next") {
    condition=and(base,eq(liveQuizRooms.status,"reveal"));
    const last=room.currentRound>=room.questions.length-1;
    patch=last?{status:"ended",endedAt:now,questionEndsAt:null,timerPausedAt:null,updatedAt:now}:{status:"active",currentRound:room.currentRound+1,questionEndsAt:room.timerEnabled?ends:null,timerPausedAt:null,updatedAt:now};
  } else if(action==="end") { condition=and(base,sql`${liveQuizRooms.status} <> 'ended'`); patch={status:"ended",endedAt:now,questionEndsAt:null,timerPausedAt:null,updatedAt:now}; }
  else if(action==="pauseTimer") {
    condition=and(base,eq(liveQuizRooms.status,"active"),eq(liveQuizRooms.timerEnabled,true),sql`${liveQuizRooms.timerPausedAt} is null`);
    patch={timerPausedAt:now,updatedAt:now};
  } else if(action==="resumeTimer") {
    condition=and(base,eq(liveQuizRooms.status,"active"),sql`${liveQuizRooms.timerPausedAt} is not null`);
    const remaining=Math.max(1000,(room.questionEndsAt?.getTime()??Date.now())-(room.timerPausedAt?.getTime()??Date.now()));
    patch={questionEndsAt:new Date(Date.now()+remaining),timerPausedAt:null,updatedAt:now};
  } else if(action==="addTime") {
    condition=and(base,eq(liveQuizRooms.status,"active"),eq(liveQuizRooms.timerEnabled,true));
    const currentEnd=room.questionEndsAt?.getTime()??Date.now();
    const reference=room.timerPausedAt?.getTime()??Date.now();
    const remaining=Math.max(0,currentEnd-reference);
    patch={questionEndsAt:new Date((room.timerPausedAt?currentEnd:Date.now()+remaining)+10_000),updatedAt:now};
  } else if(action==="setTimer") {
    if(typeof options.enabled!=="boolean") throw new LiveQuizError("حدد حالة المؤقت");
    const seconds=options.seconds??room.questionSeconds;
    if(seconds<10||seconds>120) throw new LiveQuizError("مدة السؤال بين 10 و120 ثانية");
    condition=and(base,inArray(liveQuizRooms.status,["lobby","active"]));
    patch={timerEnabled:options.enabled,questionSeconds:seconds,questionEndsAt:options.enabled&&room.status==="active"?new Date(Date.now()+seconds*1000):null,timerPausedAt:null,updatedAt:now};
  } else if(action==="setAutoReveal") {
    if(typeof options.enabled!=="boolean") throw new LiveQuizError("حدد حالة الإنهاء التلقائي");
    condition=and(base,inArray(liveQuizRooms.status,["lobby","active"]));
    patch={autoReveal:options.enabled,updatedAt:now};
  } else { throw new LiveQuizError("أمر مسابقة غير معروف",400); }
  const [updated]=await db.update(liveQuizRooms).set(patch).where(condition).returning({id:liveQuizRooms.id});
  if(!updated) throw new LiveQuizError("تغيرت حالة المسابقة؛ حدّث الشاشة وحاول مرة أخرى",409);
  if(action==="setAutoReveal" && options.enabled) await revealIfEveryoneAnswered(room.id, room.currentRound);
  await logAudit("teacher",teacherId,`live_quiz_${action}`,"live_quiz_rooms",room.id);
  return getHostState(teacherId,code);
}

export async function listLiveRooms(teacherId: number) {
  await ensureSeeded();
  const rooms=await db.select({code:liveQuizRooms.code,mode:liveQuizRooms.mode,status:liveQuizRooms.status,createdAt:liveQuizRooms.createdAt,expiresAt:liveQuizRooms.expiresAt}).from(liveQuizRooms).where(eq(liveQuizRooms.teacherId,teacherId)).orderBy(sql`${liveQuizRooms.createdAt} desc`).limit(10);
  return rooms.map((r)=>({...r,createdAt:r.createdAt.toISOString(),expiresAt:r.expiresAt.toISOString()}));
}
