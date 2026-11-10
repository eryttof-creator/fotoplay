import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Smartphone, CheckCircle2, Clock, Trophy, Play, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { TopBar } from "@/components/Chrome";
import { ProfileEditor } from "@/components/ProfileEditor";
import { useUserId } from "@/lib/session";
import { useMyProfile } from "@/lib/profile";
import { getTvSessionByCode, joinTvSession, submitTvAnswer, startTvGame } from "@/lib/api/tv.functions";
import { supabase } from "@/integrations/supabase/client";
import { playSound, unlockSound } from "@/lib/sounds";
import { pageHead } from "@/lib/metadata";
import { toast } from "sonner";

export const Route = createFileRoute("/tv/controle/$code")({
  head: ({ params }) =>
    pageHead(
      `Controle — TV ${params.code.toUpperCase()}`,
      "Controle móvel para responder às perguntas do FOTO PLAY na televisão."
    ),
  component: TvControllerPage,
});

const OPTION_THEMES = [
  { bg: "bg-coral text-card-foreground border-ink active:scale-95", label: "A" },
  { bg: "bg-sky text-card-foreground border-ink active:scale-95", label: "B" },
  { bg: "bg-sun text-card-foreground border-ink active:scale-95", label: "C" },
  { bg: "bg-lime text-card-foreground border-ink active:scale-95", label: "D" },
];

function TvControllerPage() {
  const { code: rawCode } = Route.useParams();
  const code = rawCode.toUpperCase();
  const { uid } = useUserId();
  const { profile, save } = useMyProfile();
  const navigate = useNavigate();

  const [session, setSession] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submittedRound, setSubmittedRound] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);

  const fetchSession = async () => {
    try {
      const data = await getTvSessionByCode({ data: { code } });
      setSession(data.session);
      setParticipants(data.participants);

      const me = data.participants.find((p: any) => p.user_id === uid);
      if (me) setJoined(true);

      const currentRound = (data.session.state as any)?.round ?? 1;
      if (data.answeredUserIds.includes(uid)) {
        setSubmittedRound(currentRound);
      } else if ((data.session.state as any)?.phase === "question" && submittedRound !== currentRound) {
        setSelectedOption(null);
      }

      setLoading(false);
    } catch (e: any) {
      toast.error(e?.message || "Sessão não encontrada.");
      navigate({ to: "/tv" });
    }
  };

  useEffect(() => {
    if (uid) fetchSession();
  }, [uid, code]);

  // Realtime subscription to tv_sessions and tv_participants
  useEffect(() => {
    if (!session?.id) return;

    const channel = supabase
      .channel(`tv-ctrl-${session.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tv_sessions", filter: `id=eq.${session.id}` },
        () => {
          fetchSession();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tv_participants", filter: `session_id=eq.${session.id}` },
        () => {
          fetchSession();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id, uid]);

  if (loading || !profile || !uid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hero">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user has not yet joined this TV session, prompt profile editor to join
  if (!joined) {
    return (
      <div className="min-h-screen bg-hero">
        <TopBar />
        <main className="mx-auto max-w-md px-4 py-8">
          <div className="rounded-3xl border-2 border-ink bg-card p-6 shadow-pop">
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-sun px-3 py-1 text-xs font-bold">
              <Smartphone className="h-3.5 w-3.5" /> Controle para TV
            </div>
            <h1 className="text-3xl font-extrabold mb-1">Entrar na TV</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Sala da TV: <span className="font-display font-extrabold text-primary">{code}</span>
            </p>
            <ProfileEditor
              initial={{ nickname: profile.nickname, avatar: profile.avatar, photo_path: profile.photo_path }}
              submitLabel="Conectar meu celular"
              onSubmit={async (p) => {
                await save(p);
                await joinTvSession({
                  data: { code, nickname: p.nickname, avatar: p.avatar, photo_path: p.photo_path },
                });
                setJoined(true);
                toast.success("Conectado à TV!");
                await fetchSession();
              }}
            />
          </div>
        </main>
      </div>
    );
  }

  const state = session?.state || {};
  const phase = state.phase || "lobby";
  const round = state.round || 1;
  const isHost = session?.host_id === uid;
  const me = participants.find((p) => p.user_id === uid);
  const hasSubmitted = submittedRound === round;

  return (
    <div className="min-h-screen bg-hero flex flex-col justify-between">
      <div>
        <TopBar />
        <main className="mx-auto max-w-md px-4 pb-16">
          {/* Controller Header Card */}
          <div className="mb-4 flex items-center justify-between rounded-2xl border-2 border-ink bg-card p-3 shadow-pop-sm">
            <div className="flex items-center gap-2.5">
              <PlayerAvatar photoPath={profile.photo_path} avatar={profile.avatar} size={38} />
              <div>
                <p className="font-extrabold text-sm leading-tight">{profile.nickname}</p>
                <p className="text-xs text-muted-foreground">TV: {code}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-muted px-2.5 py-1 text-xs font-extrabold">
              <Trophy className="h-3.5 w-3.5 text-primary" /> {me?.score ?? 0} pts
            </div>
          </div>

          {/* LOBBY PHASE */}
          {phase === "lobby" && (
            <div className="rounded-3xl border-2 border-ink bg-card p-6 text-center shadow-pop">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-ink bg-sun text-3xl shadow-pop-sm">
                📺
              </div>
              <h2 className="text-2xl font-extrabold">Conectado à TV!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Seu celular está pronto. Olhe para a tela da TV para acompanhar os outros jogadores entrando.
              </p>

              <div className="my-6 rounded-2xl border-2 border-dashed border-ink/40 p-4 bg-muted/50">
                <p className="text-xs font-semibold text-muted-foreground">Jogadores conectados na TV:</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {participants.map((p) => (
                    <div
                      key={p.user_id}
                      className="flex items-center gap-1 rounded-full border border-ink bg-card px-2.5 py-1 text-xs font-bold"
                    >
                      <PlayerAvatar photoPath={p.photo_path} avatar={p.avatar} size={20} />
                      <span>{p.nickname}</span>
                    </div>
                  ))}
                </div>
              </div>

              {isHost && (
                <Button
                  variant="pop"
                  size="xl"
                  disabled={busy}
                  className="w-full"
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
                  <Play className="h-5 w-5 mr-1" /> INICIAR JOGO NA TV
                </Button>
              )}
            </div>
          )}

          {/* QUESTION PHASE (ANSWER BUTTONS) */}
          {phase === "question" && (
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-ink bg-card p-4 shadow-pop-sm text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Pergunta {round} de {state.totalRounds || 5}
                </span>
                <h2 className="mt-1 font-display text-xl font-extrabold">{state.prompt}</h2>
              </div>

              {hasSubmitted ? (
                <div className="rounded-3xl border-2 border-ink bg-accent p-8 text-center shadow-pop animate-in zoom-in-95">
                  <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-800" />
                  <h3 className="mt-3 text-2xl font-extrabold">Resposta enviada!</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Aguardando os outros participantes. Olhe para a TV para ver a contagem e a revelação! 👀
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  <p className="text-center text-xs font-bold text-muted-foreground">
                    Toque na sua alternativa:
                  </p>
                  {(state.options || []).map((opt: string, idx: number) => {
                    const theme = OPTION_THEMES[idx % OPTION_THEMES.length]!;
                    const isSelected = selectedOption === idx;
                    return (
                      <button
                        key={idx}
                        disabled={busy}
                        onClick={async () => {
                          setSelectedOption(idx);
                          setBusy(true);
                          try {
                            unlockSound();
                            playSound("tap");
                            await submitTvAnswer({
                              data: {
                                sessionId: session.id,
                                round,
                                optionIndex: idx,
                              },
                            });
                            setSubmittedRound(round);
                            toast.success("Resposta registrada!");
                          } catch (e: any) {
                            toast.error(e?.message || "Erro ao enviar resposta.");
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className={`flex items-center gap-4 rounded-2xl border-2 p-5 text-left font-display shadow-pop transition-all ${
                          theme.bg
                        } ${isSelected ? "ring-4 ring-ink ring-offset-2" : ""}`}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-card text-xl font-black">
                          {theme.label}
                        </span>
                        <span className="text-lg font-extrabold leading-snug">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* REVEAL PHASE */}
          {phase === "reveal" && (
            <div className="rounded-3xl border-2 border-ink bg-card p-6 text-center shadow-pop">
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                Fim da Rodada {round}
              </span>
              <h2 className="text-2xl font-extrabold mt-1">Olhe para a TV!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                As respostas foram reveladas na tela principal.
              </p>

              {state.revealedAnswers?.[uid] !== undefined && (
                <div
                  className={`mt-4 rounded-2xl border-2 border-ink p-4 ${
                    state.revealedAnswers[uid] === state.correctIndex
                      ? "bg-accent text-emerald-950"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <p className="font-extrabold text-base">
                    {state.revealedAnswers[uid] === state.correctIndex
                      ? "🎉 Você acertou! (+100 pts)"
                      : "Quase! Não foi dessa vez."}
                  </p>
                </div>
              )}

              <p className="mt-4 text-xs text-muted-foreground">
                Aguarde a próxima pergunta ser iniciada na TV.
              </p>
            </div>
          )}

          {/* FINISHED PHASE */}
          {phase === "finished" && (
            <div className="rounded-3xl border-2 border-ink bg-card p-6 text-center shadow-pop">
              <Trophy className="mx-auto h-14 w-14 text-sun" />
              <h2 className="text-2xl font-extrabold mt-2">Partida Encerrada!</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Veja o pódio final dos campeões na TV.
              </p>
              <div className="my-4 rounded-2xl bg-muted p-4">
                <p className="text-sm font-bold">Sua pontuação final:</p>
                <p className="font-display text-4xl font-black text-primary">{me?.score ?? 0} pts</p>
              </div>
            </div>
          )}
        </main>
      </div>

      <footer className="border-t border-border bg-card p-3 text-center text-xs text-muted-foreground">
        Controle Móvel FOTO PLAY TV · Sincronizado em tempo real
      </footer>
    </div>
  );
}
