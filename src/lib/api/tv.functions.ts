import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export const TV_QUIZ_QUESTIONS = [
  {
    prompt: "Qual destes animais é conhecido por dormir mais de 18 horas por dia?",
    options: ["Preguiça", "Koala", "Gato", "Leão"],
    correctIndex: 1,
  },
  {
    prompt: "Em qual continente fica o Deserto do Saara?",
    options: ["Ásia", "América", "África", "Oceania"],
    correctIndex: 2,
  },
  {
    prompt: "Quem pintou a célebre obra 'Mona Lisa'?",
    options: ["Michelangelo", "Leonardo da Vinci", "Vincent van Gogh", "Pablo Picasso"],
    correctIndex: 1,
  },
  {
    prompt: "Quantos corações tem um polvo?",
    options: ["1 coração", "2 corações", "3 corações", "Nenhum"],
    correctIndex: 2,
  },
  {
    prompt: "Qual é o elemento químico mais abundante no universo?",
    options: ["Oxigênio", "Hélio", "Carbono", "Hidrogênio"],
    correctIndex: 3,
  },
  {
    prompt: "Qual videogame foi o mais vendido de todos os tempos?",
    options: ["Minecraft", "Tetris", "Grand Theft Auto V", "Super Mario Bros."],
    correctIndex: 0,
  },
  {
    prompt: "Quem inventou o avião 14-Bis?",
    options: ["Irmãos Wright", "Santos Dumont", "Thomas Edison", "Nikola Tesla"],
    correctIndex: 1,
  },
  {
    prompt: "Qual oceano banha o litoral leste do Brasil?",
    options: ["Pacífico", "Índico", "Atlântico", "Ártico"],
    correctIndex: 2,
  },
];

export const createTvSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      nickname: z.string().trim().min(1).max(20),
      avatar: z.string().max(10).default("a1"),
      photo_path: z.string().nullable().default(null),
      game: z.string().default("quiz"),
    })
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    for (let i = 0; i < 5; i++) {
      const code = newCode();
      const { data: session, error } = await db
        .from("tv_sessions")
        .insert({
          code,
          host_id: context.userId,
          game: data.game,
          status: "lobby",
          state: { round: 1, totalRounds: 5, phase: "lobby" },
        })
        .select()
        .single();
      if (error) continue;

      // Add host as participant
      await db.from("tv_participants").insert({
        session_id: session.id,
        user_id: context.userId,
        nickname: data.nickname,
        avatar: data.avatar,
        photo_path: data.photo_path,
        score: 0,
      });

      return { code, sessionId: session.id };
    }
    throw new Error("Não foi possível criar a sessão TV. Tente novamente.");
  });

export const joinTvSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      code: z.string().trim().toUpperCase().regex(CODE_RE, "Código da TV inválido"),
      nickname: z.string().trim().min(1, "Escolha um apelido").max(20),
      avatar: z.string().max(10).default("a1"),
      photo_path: z.string().nullable().default(null),
    })
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: session } = await db
      .from("tv_sessions")
      .select("*")
      .eq("code", data.code)
      .maybeSingle();
    if (!session) throw new Error("Sessão da TV não encontrada. Verifique o código.");
    if (session.status === "finished") throw new Error("Esta sessão já foi encerrada.");

    await db.from("tv_participants").upsert({
      session_id: session.id,
      user_id: context.userId,
      nickname: data.nickname,
      avatar: data.avatar,
      photo_path: data.photo_path,
      last_seen: new Date().toISOString(),
    });

    return { code: session.code, sessionId: session.id, status: session.status };
  });

export const getTvSessionByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ code: z.string().trim().toUpperCase().regex(CODE_RE) }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: session } = await db
      .from("tv_sessions")
      .select("*")
      .eq("code", data.code)
      .maybeSingle();
    if (!session) throw new Error("Sessão não encontrada.");

    const { data: participants } = await db
      .from("tv_participants")
      .select("*")
      .eq("session_id", session.id)
      .order("score", { ascending: false });

    // Check which participants have submitted answers for the current round
    const currentRound = (session.state as any)?.round ?? 1;
    const { data: roundAnswers } = await db
      .from("tv_answers")
      .select("user_id, created_at")
      .eq("session_id", session.id)
      .eq("round", currentRound);

    const answeredUserIds = (roundAnswers ?? []).map((a: any) => a.user_id);

    return {
      session,
      participants: participants ?? [],
      answeredUserIds,
      serverNow: Date.now(),
    };
  });

export const startTvGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ sessionId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: session } = await db
      .from("tv_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("Sessão não encontrada.");
    if (session.host_id !== context.userId) throw new Error("Apenas o anfitrião pode iniciar a partida na TV.");

    const firstQuestion = TV_QUIZ_QUESTIONS[0]!;
    const newState = {
      round: 1,
      totalRounds: 5,
      phase: "question", // 'question' | 'reveal' | 'finished'
      prompt: firstQuestion.prompt,
      options: firstQuestion.options,
      correctIndex: firstQuestion.correctIndex,
      endsAt: Date.now() + 25000,
      answeredUserIds: [],
    };

    const { error } = await db
      .from("tv_sessions")
      .update({
        status: "playing",
        state: newState,
        version: session.version + 1,
      })
      .eq("id", session.id);

    if (error) throw error;
    return { ok: true };
  });

export const submitTvAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      sessionId: z.string().uuid(),
      round: z.number(),
      optionIndex: z.number().min(0).max(3),
    })
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: session } = await db
      .from("tv_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session || session.status !== "playing") throw new Error("Partida não está ativa.");

    const state = session.state as any;
    if (state.phase !== "question" || state.round !== data.round) {
      throw new Error("A rodada não está aceitando respostas no momento.");
    }

    // Save answer
    await db.from("tv_answers").upsert({
      session_id: session.id,
      round: data.round,
      user_id: context.userId,
      answer: { optionIndex: data.optionIndex },
    });

    // Check how many players have answered
    const { data: participants } = await db
      .from("tv_participants")
      .select("user_id")
      .eq("session_id", session.id);
    const { data: allAnswers } = await db
      .from("tv_answers")
      .select("user_id, answer")
      .eq("session_id", session.id)
      .eq("round", data.round);

    const totalParticipants = participants?.length ?? 1;
    const answeredCount = allAnswers?.length ?? 0;

    // If everyone answered, finish the round and reveal!
    if (answeredCount >= totalParticipants) {
      const revealedAnswers: Record<string, number> = {};
      const scoreIncrements: Record<string, number> = {};

      allAnswers?.forEach((ans: any) => {
        const opt = (ans.answer as any)?.optionIndex;
        revealedAnswers[ans.user_id] = opt;
        if (opt === state.correctIndex) {
          scoreIncrements[ans.user_id] = 100;
        }
      });

      const nextState = {
        ...state,
        phase: "reveal",
        revealedAnswers,
        answeredUserIds: Object.keys(revealedAnswers),
      };

      await db.rpc("commit_tv_round", {
        s: session.id,
        v: session.version,
        new_state: nextState,
        new_status: "playing",
        scores: scoreIncrements,
      });
    }

    return { ok: true, answeredCount, totalParticipants };
  });

export const revealTvRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ sessionId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: session } = await db
      .from("tv_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session || session.status !== "playing") return { ok: true };

    const state = session.state as any;
    if (state.phase === "reveal") return { ok: true };

    const { data: allAnswers } = await db
      .from("tv_answers")
      .select("user_id, answer")
      .eq("session_id", session.id)
      .eq("round", state.round);

    const revealedAnswers: Record<string, number> = {};
    const scoreIncrements: Record<string, number> = {};

    allAnswers?.forEach((ans: any) => {
      const opt = (ans.answer as any)?.optionIndex;
      revealedAnswers[ans.user_id] = opt;
      if (opt === state.correctIndex) {
        scoreIncrements[ans.user_id] = 100;
      }
    });

    const nextState = {
      ...state,
      phase: "reveal",
      revealedAnswers,
      answeredUserIds: Object.keys(revealedAnswers),
    };

    await db.rpc("commit_tv_round", {
      s: session.id,
      v: session.version,
      new_state: nextState,
      new_status: "playing",
      scores: scoreIncrements,
    });

    return { ok: true };
  });

export const nextTvRound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ sessionId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: session } = await db
      .from("tv_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("Sessão não encontrada.");
    if (session.host_id !== context.userId) throw new Error("Apenas o anfitrião pode avançar a partida.");

    const state = session.state as any;
    const nextRound = (state.round ?? 1) + 1;

    if (nextRound > (state.totalRounds ?? 5) || nextRound > TV_QUIZ_QUESTIONS.length) {
      // Game finished!
      await db
        .from("tv_sessions")
        .update({
          status: "finished",
          state: { ...state, phase: "finished" },
          version: session.version + 1,
        })
        .eq("id", session.id);
      return { ok: true, finished: true };
    }

    const q = TV_QUIZ_QUESTIONS[nextRound - 1];
    if (!q) throw new Error("Rodada inválida.");
    const newState = {
      round: nextRound,
      totalRounds: state.totalRounds ?? 5,
      phase: "question",
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      endsAt: Date.now() + 25000,
      answeredUserIds: [],
      revealedAnswers: null,
    };

    await db
      .from("tv_sessions")
      .update({
        state: newState,
        version: session.version + 1,
      })
      .eq("id", session.id);

    return { ok: true, finished: false };
  });
