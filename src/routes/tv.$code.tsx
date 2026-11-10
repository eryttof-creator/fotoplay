import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Loader2, Play, Users, Trophy, Sparkles, ArrowRight, RotateCcw, Volume2, VolumeX, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Confetti } from "@/components/Chrome";
import { QRCodeSvg } from "@/components/QRCodeSvg";
import { getTvSessionByCode, startTvGame, revealTvRound, nextTvRound } from "@/lib/api/tv.functions";
import { supabase } from "@/integrations/supabase/client";
import { playSound, unlockSound, useSoundPreference } from "@/lib/sounds";
import { pageHead } from "@/lib/metadata";
import { toast } from "sonner";

export const Route = createFileRoute("/tv/$code")({
  head: ({ params }) =>
    pageHead(
      `TV — Sala ${params.code.toUpperCase()}`,
      "Tela da TV para acompanhar as rodadas e placar em tempo real no FOTO PLAY."
    ),
  component: TvScreenPage,
});

const OPTION_COLORS = [
  { bg: "bg-coral text-card-foreground border-ink", label: "A", badge: "bg-white/80 text-black" },
  { bg: "bg-sky text-card-foreground border-ink", label: "B", badge: "bg-white/80 text-black" },
  { bg: "bg-sun text-card-foreground border-ink", label: "C", badge: "bg-white/80 text-black" },
  { bg: "bg-lime text-card-foreground border-ink", label: "D", badge: "bg-white/80 text-black" },
];

function TvScreenPage() {
  const { code: rawCode } = Route.useParams();
  const code = rawCode.toUpperCase();
  const navigate = useNavigate();
  const sound = useSoundPreference();

  const [session, setSession] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(25);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Compute full controller URL for the QR Code
  const controllerUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tv/controle/${code}`
      : `https://fotoplay.lovable.app/tv/controle/${code}`;

  const fetchState = async () => {
    try {
      const data = await getTvSessionByCode({ data: { code } });
      setSession(data.session);
      setParticipants(data.participants);
      setAnsweredIds(data.answeredUserIds);
      setLoading(false);
    } catch (e: any) {
      toast.error(e?.message || "Sessão não encontrada.");
      navigate({ to: "/tv" });
    }
  };

  useEffect(() => {
    fetchState();
  }, [code]);

  // Realtime subscription to tv_sessions, tv_participants, and tv_answers
  useEffect(() => {
    if (!session?.id) return;

    const channel = supabase
      .channel(`tv-screen-${session.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tv_sessions", filter: `id=eq.${session.id}` },
        () => {
          fetchState();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tv_participants", filter: `session_id=eq.${session.id}` },
        () => {
          fetchState();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tv_answers", filter: `session_id=eq.${session.id}` },
        (payload: any) => {
          if (payload.new?.user_id) {
            setAnsweredIds((prev) =>
              prev.includes(payload.new.user_id) ? prev : [...prev, payload.new.user_id]
            );
            playSound("tick");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id]);

  // Timer loop for question phase
  useEffect(() => {
    if (session?.status !== "playing" || session?.state?.phase !== "question") return;

    const endsAt = session.state.endsAt;
    if (!endsAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        playSound("error");
        // Time expired! Trigger reveal on TV
        void revealTvRound({ data: { sessionId: session.id } }).catch(() => {});
      }
    }, 500);

    return () => clearInterval(interval);
  }, [session?.id, session?.status, session?.state?.phase, session?.state?.endsAt]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const state = session.state || {};
  const phase = state.phase || "lobby";

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col justify-between selection:bg-primary selection:text-white">
      {/* TV Header Bar */}
      <header className="flex items-center justify-between border-b-2 border-slate-700 bg-slate-950 px-8 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 -rotate-6 items-center justify-center rounded-2xl border-2 border-ink bg-primary text-xl font-extrabold shadow-pop-sm">
            📺
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-wide">
              FOTO<span className="text-primary">PLAY</span> TV
            </h1>
            <p className="text-xs font-semibold text-slate-400">Modo Segunda Tela</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-2xl border-2 border-slate-700 bg-slate-800 px-4 py-2 font-display text-2xl font-extrabold tracking-widest text-primary shadow-inner">
            <span className="text-sm font-bold text-slate-400 tracking-normal">CÓDIGO:</span> {code}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-300 hover:text-white"
            onClick={sound.toggle}
            title={sound.on ? "Silenciar sons" : "Ativar sons"}
          >
            {sound.on ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6 text-destructive" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-300 hover:text-white"
            onClick={toggleFullscreen}
            title="Tela cheia"
          >
            <Maximize2 className="h-6 w-6" />
          </Button>
        </div>
      </header>

      {/* Main TV Display Stage */}
      <main className="flex-1 p-8 flex flex-col justify-center max-w-7xl mx-auto w-full">
        {phase === "lobby" && (
          <div className="grid gap-8 lg:grid-cols-2 items-center">
            {/* Left: QR Code and Room Instructions */}
            <div className="flex flex-col items-center text-center p-8 rounded-3xl border-4 border-slate-700 bg-slate-800/80 shadow-2xl">
              <span className="text-sm font-bold uppercase tracking-wider text-primary">Conecte seu celular</span>
              <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Aponte a câmera da TV</h2>
              <div className="my-6 p-4 bg-white rounded-3xl shadow-xl">
                <QRCodeSvg value={controllerUrl} size={240} />
              </div>
              <p className="text-slate-300 text-lg">
                Ou acesse pelo navegador: <br />
                <span className="font-bold text-primary text-xl">fotoplay / tv</span> e digite o código{" "}
                <span className="font-display font-extrabold text-2xl tracking-widest text-sun">{code}</span>
              </p>
            </div>

            {/* Right: Connected Players List */}
            <div className="flex flex-col justify-between h-full p-8 rounded-3xl border-4 border-slate-700 bg-slate-800/80 shadow-2xl">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-extrabold flex items-center gap-2">
                    <Users className="h-6 w-6 text-primary" /> Jogadores Conectados
                  </h3>
                  <span className="rounded-full bg-primary/20 border border-primary px-3 py-1 font-bold text-sm text-primary">
                    {participants.length} na sala
                  </span>
                </div>

                {participants.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
                    Aguardando amigos entrarem pelo celular...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[360px] overflow-y-auto p-2">
                    {participants.map((p) => (
                      <div
                        key={p.user_id}
                        className="flex flex-col items-center p-3 rounded-2xl border-2 border-slate-600 bg-slate-900 text-center animate-in fade-in"
                      >
                        <PlayerAvatar photoPath={p.photo_path} avatar={p.avatar} size={54} />
                        <span className="mt-2 font-bold text-base truncate max-w-[120px]">{p.nickname}</span>
                        <span className="text-xs text-primary font-medium">Pronto ✓</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-8">
                <Button
                  variant="pop"
                  size="xl"
                  disabled={participants.length < 1 || busy}
                  className="w-full text-xl py-6 font-display uppercase tracking-wider"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      unlockSound();
                      playSound("round");
                      await startTvGame({ data: { sessionId: session.id } });
                      toast.success("Partida iniciada!");
                    } catch (e: any) {
                      toast.error(e?.message || "Não foi possível iniciar.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Play className="h-6 w-6 mr-2" /> INICIAR QUIZ NA TV
                </Button>
                <p className="text-xs text-center text-slate-400 mt-2">
                  O anfitrião também pode clicar em iniciar pelo próprio celular!
                </p>
              </div>
            </div>
          </div>
        )}

        {phase === "question" && (
          <div className="flex flex-col gap-6">
            {/* Top Indicator: Round & Timer */}
            <div className="flex items-center justify-between rounded-2xl border-2 border-slate-700 bg-slate-800 px-6 py-3">
              <span className="font-display text-xl font-bold text-primary">
                Pergunta {state.round || 1} de {state.totalRounds || 5}
              </span>

              {/* Countdown Display */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Tempo:</span>
                <span
                  className={`font-display text-3xl font-extrabold ${
                    timeLeft <= 5 ? "text-destructive animate-pulse" : "text-sun"
                  }`}
                >
                  {timeLeft}s
                </span>
              </div>
            </div>

            {/* Question Text Box */}
            <div className="rounded-3xl border-4 border-slate-700 bg-slate-800 p-8 shadow-2xl text-center">
              <h2 className="font-display text-3xl sm:text-5xl font-extrabold leading-tight text-white">
                {state.prompt}
              </h2>
            </div>

            {/* 4 Alternatives (Full Screen Layout) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(state.options || []).map((opt: string, idx: number) => {
                const color = OPTION_COLORS[idx % OPTION_COLORS.length]!;
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-4 rounded-3xl border-4 p-6 shadow-pop transition-transform ${color.bg}`}
                  >
                    <span
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl font-display text-2xl font-black ${color.badge}`}
                    >
                      {color.label}
                    </span>
                    <span className="text-2xl sm:text-3xl font-extrabold leading-snug">{opt}</span>
                  </div>
                );
              })}
            </div>

            {/* Collective Answer Count (WITHOUT revealing who chose what!) */}
            <div className="rounded-2xl border-2 border-slate-700 bg-slate-850 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-slate-300 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  {answeredIds.length} de {participants.length} jogadores responderam
                </span>
                <span className="text-xs text-slate-400">
                  Respostas individuais protegidas até o final da rodada
                </span>
              </div>

              {/* Participant cards with Checkmarks only */}
              <div className="flex flex-wrap gap-3">
                {participants.map((p) => {
                  const hasAnswered = answeredIds.includes(p.user_id);
                  return (
                    <div
                      key={p.user_id}
                      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 transition-all ${
                        hasAnswered
                          ? "border-emerald-500 bg-emerald-950/40 text-emerald-300"
                          : "border-slate-700 bg-slate-900 text-slate-400 opacity-60"
                      }`}
                    >
                      <PlayerAvatar photoPath={p.photo_path} avatar={p.avatar} size={28} />
                      <span className="text-sm font-bold">{p.nickname}</span>
                      {hasAnswered && <span className="text-xs font-black">✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {phase === "reveal" && (
          <div className="flex flex-col gap-6 animate-in zoom-in-95 duration-300">
            {/* Header Result */}
            <div className="text-center">
              <span className="text-sm font-bold uppercase tracking-widest text-emerald-400">Tempo esgotado!</span>
              <h2 className="text-4xl font-extrabold sm:text-5xl mt-1">Revelação das Respostas</h2>
            </div>

            {/* Alternatives with who voted for what */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(state.options || []).map((opt: string, idx: number) => {
                const isCorrect = idx === state.correctIndex;
                const voters = participants.filter(
                  (p) => state.revealedAnswers?.[p.user_id] === idx
                );

                return (
                  <div
                    key={idx}
                    className={`relative rounded-3xl border-4 p-6 shadow-2xl transition-all ${
                      isCorrect
                        ? "border-emerald-400 bg-emerald-950/80 ring-4 ring-emerald-400 ring-offset-2 ring-offset-slate-900"
                        : "border-slate-700 bg-slate-800/60 opacity-70"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-xl font-display text-xl font-black ${
                          isCorrect ? "bg-emerald-400 text-black" : "bg-slate-700 text-white"
                        }`}
                      >
                        {OPTION_COLORS[idx % OPTION_COLORS.length]!.label}
                      </span>
                      {isCorrect && (
                        <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-black uppercase text-black">
                          Correta ✓
                        </span>
                      )}
                    </div>

                    <h3 className="text-2xl sm:text-3xl font-extrabold">{opt}</h3>

                    {/* Avatars of players who picked this */}
                    <div className="mt-4 pt-4 border-t border-slate-700/60 min-h-[48px] flex flex-wrap gap-2 items-center">
                      {voters.length === 0 ? (
                        <span className="text-xs text-slate-500">Nenhum voto</span>
                      ) : (
                        voters.map((p) => (
                          <div
                            key={p.user_id}
                            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 border border-slate-600 px-2.5 py-1 text-xs font-bold"
                          >
                            <PlayerAvatar photoPath={p.photo_path} avatar={p.avatar} size={22} />
                            <span>{p.nickname}</span>
                            {isCorrect && <span className="text-emerald-400">+100</span>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Scoreboard Preview */}
            <div className="flex items-center justify-between rounded-2xl border-2 border-slate-700 bg-slate-800 p-4">
              <div className="flex items-center gap-4">
                <Trophy className="h-6 w-6 text-sun" />
                <div className="flex gap-4">
                  {participants.slice(0, 4).map((p, rank) => (
                    <div key={p.user_id} className="text-sm">
                      <span className="text-slate-400">#{rank + 1}</span>{" "}
                      <span className="font-bold text-white">{p.nickname}</span>:{" "}
                      <span className="font-extrabold text-primary">{p.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant="popLime"
                size="lg"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    playSound("round");
                    await nextTvRound({ data: { sessionId: session.id } });
                  } catch (e: any) {
                    toast.error(e?.message || "Não foi possível avançar.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Próxima Pergunta <ArrowRight className="h-5 w-5 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {phase === "finished" && (
          <div className="flex flex-col items-center justify-center text-center p-8 rounded-3xl border-4 border-slate-700 bg-slate-800/90 shadow-2xl relative overflow-hidden">
            <Confetti />
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-sun/20 border-2 border-sun px-4 py-1 font-bold text-sun text-sm">
              <Sparkles className="h-4 w-4" /> FIM DE JOGO
            </div>
            <h2 className="font-display text-5xl sm:text-7xl font-extrabold text-white">
              Pódio dos Campeões!
            </h2>
            <p className="mt-2 text-slate-300 text-lg">Parabéns aos maiores pontuadores do Quiz!</p>

            {/* Podium Display */}
            <div className="flex items-end justify-center gap-4 sm:gap-8 my-10 w-full max-w-2xl">
              {/* 2nd Place */}
              {participants[1] && (
                <div className="flex flex-col items-center flex-1">
                  <PlayerAvatar photoPath={participants[1].photo_path} avatar={participants[1].avatar} size={64} />
                  <span className="mt-2 font-bold text-lg truncate">{participants[1].nickname}</span>
                  <span className="text-sm font-extrabold text-slate-400">{participants[1].score} pts</span>
                  <div className="w-full h-32 bg-slate-700 rounded-t-2xl border-2 border-slate-600 mt-3 flex items-center justify-center font-display text-4xl font-extrabold text-slate-300">
                    2º
                  </div>
                </div>
              )}

              {/* 1st Place */}
              {participants[0] && (
                <div className="flex flex-col items-center flex-1 -mt-8">
                  <span className="text-4xl mb-1">👑</span>
                  <PlayerAvatar photoPath={participants[0].photo_path} avatar={participants[0].avatar} size={84} />
                  <span className="mt-2 font-extrabold text-2xl truncate text-sun">{participants[0].nickname}</span>
                  <span className="text-lg font-black text-sun">{participants[0].score} pts</span>
                  <div className="w-full h-44 bg-sun rounded-t-2xl border-4 border-ink mt-3 flex items-center justify-center font-display text-6xl font-black text-ink shadow-pop">
                    1º
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {participants[2] && (
                <div className="flex flex-col items-center flex-1">
                  <PlayerAvatar photoPath={participants[2].photo_path} avatar={participants[2].avatar} size={60} />
                  <span className="mt-2 font-bold text-base truncate">{participants[2].nickname}</span>
                  <span className="text-sm font-extrabold text-slate-400">{participants[2].score} pts</span>
                  <div className="w-full h-24 bg-amber-800/80 rounded-t-2xl border-2 border-amber-700 mt-3 flex items-center justify-center font-display text-3xl font-extrabold text-amber-200">
                    3º
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <Button
                variant="pop"
                size="xl"
                onClick={async () => {
                  try {
                    await startTvGame({ data: { sessionId: session.id } });
                  } catch (e: any) {
                    toast.error(e?.message || "Não foi possível reiniciar.");
                  }
                }}
              >
                <RotateCcw className="h-5 w-5 mr-2" /> Jogar Novamente
              </Button>
              <Button variant="ghost" size="xl" onClick={() => navigate({ to: "/tv" })}>
                Sair da TV
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* TV Footer Bar */}
      <footer className="border-t-2 border-slate-800 bg-slate-950 px-8 py-3 text-center text-xs text-slate-500">
        FOTO PLAY TV · Acompanhe ao vivo pelo telão e use os celulares como controle interativo
      </footer>
    </div>
  );
}
