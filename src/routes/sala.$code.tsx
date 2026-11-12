import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Copy, Share2, LogOut, Crown, Check, Loader2, RotateCcw, WifiOff, Pencil, History, Home, Users, Bot, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TopBar, Confetti } from "@/components/Chrome";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ProfileEditor } from "@/components/ProfileEditor";
import { InviteFriendsModal } from "@/components/InviteFriendsModal";
import { TicTacToe, Memory, RockPaperScissors, Reaction, GuessPhoto, WhoAmI, type GameProps } from "@/components/games/Games";
import { Stop, Quiz, Draw, Truth } from "@/components/games/PartyGames";
import { playSound, unlockSound } from "@/lib/sounds";
import { useRef } from "react";
import { GAMES, gameInfo, playersLabel } from "@/lib/games/catalog";
import { GAME_LIMITS, type GameId } from "@/lib/games/engine";
import { useUserId } from "@/lib/session";
import { useMyProfile } from "@/lib/profile";
import { useRoom, isOnline, type PlayerRow, type RoomRow } from "@/lib/useRoom";
import { BOT_GAMES } from "@/lib/games/bots";
import { addBot, botStep, removeBot, gameAction, getRoomByCode, joinRoom, leaveRoom, rematch, selectGame, setReady, startGame, updateMe } from "@/lib/api/rooms.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sala/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Sala ${params.code.toUpperCase()} — FOTO PLAY` },
      { name: "description", content: "Entre na sala com o código e jogue com seus amigos no FOTO PLAY." },
      { property: "og:title", content: `Bora jogar? Sala ${params.code.toUpperCase()} no FOTO PLAY` },
      { property: "og:description", content: "Seus amigos, suas fotos, seus jogos! Entre com o código da sala." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomPage,
});

const GAME_UI: Record<GameId, (p: GameProps) => React.ReactElement> = {
  tictactoe: TicTacToe, memory: Memory, rps: RockPaperScissors, guess: GuessPhoto, whoami: WhoAmI, reaction: Reaction,
  stop: Stop, quiz: Quiz, draw: Draw, truth: Truth,
};
const errMsg = (e: any) => {
  const m = String(e?.message ?? e);
  try {
    const parsed = JSON.parse(m);
    if (Array.isArray(parsed)) return parsed[0]?.message ?? "Dados inválidos.";
  } catch {}
  return m;
};

function RoomPage() {
  const { code: raw } = Route.useParams();
  const code = raw.toUpperCase();
  const { uid } = useUserId();
  const [roomId, setRoomId] = useState<string | null | undefined>(undefined);
  const { profile, save } = useMyProfile();
  const navigate = useNavigate();

  const lookup = useCallback(async () => {
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) return setRoomId(null);
    const r = await getRoomByCode({ data: { code } });
    setRoomId(r.roomId);
  }, [code]);
  useEffect(() => {
    if (uid) lookup().catch(() => setRoomId(null));
  }, [uid, lookup]);

  if (roomId === undefined || !uid || !profile)
    return <Center><Loader2 className="h-8 w-8 animate-spin" /></Center>;

  if (roomId === null)
    return (
      <div className="min-h-screen bg-hero">
        <TopBar />
        <main className="mx-auto max-w-md px-4 pb-16">
          <div className="rounded-3xl border-2 border-ink bg-card p-6 shadow-pop">
            <p className="text-sm text-muted-foreground">Entrando na sala</p>
            <h1 className="mb-5 font-display text-4xl font-extrabold tracking-[0.2em]">{code}</h1>
            <ProfileEditor
              initial={{ nickname: profile.nickname, avatar: profile.avatar, photo_path: profile.photo_path }}
              submitLabel="Entrar na sala"
              onSubmit={async (p) => {
                await save(p);
                try {
                  await joinRoom({ data: { ...p, code } });
                } catch (e) {
                  throw new Error(errMsg(e));
                }
                await lookup();
              }}
            />
          </div>
          <Button variant="ghost" className="mt-4 w-full" onClick={() => navigate({ to: "/" })}>Voltar ao início</Button>
        </main>
      </div>
    );

  return <RoomView roomId={roomId} me={uid} onLeft={() => navigate({ to: "/" })} saveProfile={save} />;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-hero">{children}</div>;
}

function RoomView({ roomId, me, onLeft, saveProfile }: { roomId: string; me: string; onLeft: () => void; saveProfile: (p: any) => Promise<void> }) {
  const { room, players, history, secrets, gone, connected, offset, refresh } = useRoom(roomId);
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (room) localStorage.setItem("fp-last-room", room.code);
  }, [room?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  const meRow = players.find((p) => p.user_id === me);
  useEffect(() => {
    if (gone || (room && players.length && !meRow)) {
      localStorage.removeItem("fp-last-room");
      toast("Você saiu da sala.");
      onLeft();
    }
  }, [gone, meRow, players.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!room || !meRow) return <Center><Loader2 className="h-8 w-8 animate-spin" /></Center>;

  const leave = async () => {
    await leaveRoom({ data: { roomId } }).catch(() => {});
    localStorage.removeItem("fp-last-room");
    onLeft();
  };

  return (
    <div className="min-h-screen bg-hero">
      <TopBar
        right={
          <div className="flex items-center gap-2">
            <Button variant="pop" size="sm" className="h-10" onClick={() => setInviting(true)}>
              <Users className="h-4 w-4 mr-1" /> Convidar amigos
            </Button>
            <Button variant="popPlain" size="sm" className="h-10" onClick={leave}>
              <LogOut /> Sair
            </Button>
          </div>
        }
      />
      {!connected && (
        <div className="mx-auto mb-3 flex w-fit items-center gap-2 rounded-full border-2 border-ink bg-sun px-4 py-1.5 text-sm font-bold">
          <WifiOff className="h-4 w-4" /> Reconectando…
        </div>
      )}
      <main className="mx-auto max-w-5xl px-4 pb-16">
        {room.status === "playing" ? (
          <Match room={room} players={players} me={me} offset={offset} secrets={secrets} refresh={refresh} />
        ) : (
          <Lobby room={room} players={players} me={me} history={history} onEdit={() => setEditing(true)} onInvite={() => setInviting(true)} />
        )}
      </main>
      <InviteFriendsModal
        open={inviting}
        onOpenChange={setInviting}
        roomId={roomId}
        roomCode={room.code}
        roomStatus={room.status}
      />
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-2 border-ink">
          <DialogHeader><DialogTitle className="font-display text-2xl">Seu perfil na sala</DialogTitle></DialogHeader>
          <ProfileEditor
            initial={{ nickname: meRow.nickname, avatar: meRow.avatar, photo_path: meRow.photo_path }}
            submitLabel="Salvar"
            onSubmit={async (p) => {
              await saveProfile(p);
              await updateMe({ data: { ...p, roomId } });
              setEditing(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Lobby({ room, players, me, history, onEdit, onInvite }: { room: RoomRow; players: PlayerRow[]; me: string; history: any[]; onEdit: () => void; onInvite: () => void }) {
  const isHost = room.host_id === me;
  const meRow = players.find((p) => p.user_id === me)!;
  const lim = GAME_LIMITS[room.game as GameId];
  const allReady = players.every((p) => p.ready);
  const countOk = players.length >= lim.min && players.length <= lim.max;
  const [busy, setBusy] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/sala/${room.code}` : "";
  const hasBots = players.some((p) => p.is_bot);
  const botsOk = !hasBots || BOT_GAMES.includes(room.game as GameId);
  const reason = !countOk
    ? players.length < lim.min ? `Precisa de ${lim.min - players.length} jogador(es) a mais — adicione um robô!` : `Máximo de ${lim.max} jogadores neste jogo`
    : !botsOk ? "Os robôs não sabem jogar este jogo. Escolha um com 🤖." : !allReady ? "Esperando todos ficarem prontos" : null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <div className="flex flex-col gap-6">
        <section className="rounded-3xl border-2 border-ink bg-card p-5 shadow-pop">
          <p className="text-sm text-muted-foreground">Código da sala</p>
          <p className="font-display text-5xl font-extrabold tracking-[0.25em]">{room.code}</p>
          {room.state?.aborted && <p className="mt-2 rounded-xl bg-sun px-3 py-1.5 text-sm font-medium">{room.state.aborted}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="pop" size="sm" onClick={onInvite}>
              <Users /> Convidar amigos
            </Button>
            <Button variant="popLime" size="sm" onClick={() => { navigator.clipboard.writeText(room.code); toast.success("Código copiado!"); }}>
              <Copy /> Copiar código
            </Button>
            <Button
              variant="popPlain"
              size="sm"
              onClick={async () => {
                if (navigator.share) await navigator.share({ title: "FOTO PLAY", text: `Bora jogar! Código: ${room.code}`, url }).catch(() => {});
                else { navigator.clipboard.writeText(url); toast.success("Link copiado!"); }
              }}
            >
              <Share2 /> Convidar link
            </Button>
          </div>
        </section>

        <section className="rounded-3xl border-2 border-ink bg-card p-5 shadow-pop">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold">Jogadores ({players.length}/8)</h2>
            <Button variant="ghost" size="sm" onClick={onEdit}><Pencil /> Editar meu perfil</Button>
          </div>
          <ul className="flex flex-col gap-2">
            {players.map((p) => (
              <li key={p.user_id} className="flex items-center gap-3 rounded-2xl bg-muted p-2.5">
                <div className="relative">
                  <PlayerAvatar photoPath={p.photo_path} avatar={p.avatar} size={44} />
                  <span className={cn("absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card", isOnline(p) ? "bg-success" : "bg-muted-foreground")} />
                </div>
                <div className="flex-1">
                  <p className="flex items-center gap-1 font-bold">
                    {p.nickname} {p.user_id === me && <span className="text-xs font-normal text-muted-foreground">(você)</span>}
                    {p.is_bot && <span className="rounded-full bg-card px-2 text-xs font-medium">robô</span>}
                    {p.user_id === room.host_id && <Crown className="h-4 w-4 text-primary" aria-label="Anfitrião" />}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.wins} vitória(s) na sala{!isOnline(p) && " · offline"}</p>
                </div>
                {p.is_bot && isHost && (
                  <Button variant="ghost" size="icon" aria-label={`Remover ${p.nickname}`} disabled={busy} onClick={() => run(() => removeBot({ data: { roomId: room.id, botId: p.user_id } }))}>
                    <X />
                  </Button>
                )}
                <span className={cn("rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold", p.ready ? "bg-accent" : "bg-card")}>
                  {p.ready ? "Pronto" : "Aguardando"}
                </span>
              </li>
            ))}
          </ul>
          {isHost && players.length < 8 && (
            <Button variant="popPlain" size="sm" className="mt-3 w-full" disabled={busy} onClick={() => run(() => addBot({ data: { roomId: room.id } }))}>
              <Bot /> Adicionar robô
            </Button>
          )}
          <Button
            variant={meRow.ready ? "popPlain" : "popLime"}
            size="xl"
            className="mt-4 w-full"
            disabled={busy}
            onClick={() => run(() => setReady({ data: { roomId: room.id, ready: !meRow.ready } }))}
          >
            {meRow.ready ? "Não estou pronto" : <><Check /> Estou pronto!</>}
          </Button>
        </section>
      </div>

      <div className="flex flex-col gap-6">
        <section className="rounded-3xl border-2 border-ink bg-card p-5 shadow-pop">
          <h2 className="mb-1 text-xl font-bold">Escolha o jogo</h2>
          <p className="mb-4 text-sm text-muted-foreground">{isHost ? "Você é o anfitrião: escolha e inicie." : "O anfitrião escolhe o jogo."} Jogos com 🤖 aceitam robôs.</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {GAMES.map((g) => (
              <button
                key={g.id}
                disabled={!isHost || busy}
                onClick={() => run(() => selectGame({ data: { roomId: room.id, game: g.id } }))}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition-all",
                  room.game === g.id ? "border-ink bg-accent shadow-pop-sm" : "border-border bg-muted",
                  isHost && room.game !== g.id && "hover:border-ink",
                )}
              >
                <span className="text-2xl">{g.emoji}</span>
                <span className="text-sm font-bold leading-tight">{g.name}</span>
                <span className="text-xs text-muted-foreground">{playersLabel(g.id)}{BOT_GAMES.includes(g.id) && " · 🤖"}</span>
              </button>
            ))}
          </div>
          {isHost ? (
            <>
              <Button variant="pop" size="xl" className="mt-5 w-full" disabled={!!reason || busy} onClick={() => run(() => startGame({ data: { roomId: room.id } }))}>
                {busy && <Loader2 className="animate-spin" />} Iniciar {gameInfo(room.game).name}
              </Button>
              {reason && <p className="mt-2 text-center text-sm text-muted-foreground">{reason}</p>}
            </>
          ) : (
            <p className="mt-5 rounded-2xl bg-muted p-3 text-center text-sm">
              {reason ?? "Tudo pronto! Esperando o anfitrião iniciar."}
            </p>
          )}
        </section>

        <section className="rounded-3xl border-2 border-ink bg-card p-5 shadow-pop-sm">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><History className="h-5 w-5" /> Histórico da sala</h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma partida ainda. Que comecem os jogos!</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
                  <span>{gameInfo(h.game).emoji}</span>
                  <span className="flex-1">{h.summary}</span>
                  <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Match({ room, players, me, offset, secrets, refresh }: { room: RoomRow; players: PlayerRow[]; me: string; offset: number; secrets: Record<string, any>; refresh: () => void }) {
  const state = room.state;
  const ids: string[] = state.playerIds ?? [];
  const inGame = ids.map((id) => players.find((p) => p.user_id === id)).filter(Boolean) as PlayerRow[];
  const spectator = !ids.includes(me);
  const isHost = room.host_id === me;
  const info = gameInfo(room.game);
  const UI = GAME_UI[room.game as GameId];
  const finished = state.finished as { winners: string[]; summary: string } | undefined;
  const [busy, setBusy] = useState(false);

  const act = useCallback(
    async (type: string, payload: Record<string, unknown> = {}) => {
      unlockSound();
      try {
        const r = await gameAction({ data: { roomId: room.id, type, payload } });
        if (!r.ok) {
          if (type !== "timeout") playSound("error");
          if (type !== "timeout") toast.error(r.error);
          return false;
        }
        if (!["timeout", "stroke", "save"].includes(type)) playSound("tap");
        return true;
      } catch (e) {
        toast.error(errMsg(e));
        refresh();
        return false;
      }
    },
    [room.id, refresh],
  );
  const doRematch = async (toLobby: boolean) => {
    setBusy(true);
    try { await rematch({ data: { roomId: room.id, toLobby } }); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  // The host's browser paces the robots: one robot move per state change, after a short "thinking" pause.
  const botsInGame = inGame.some((p) => p.is_bot);
  useEffect(() => {
    if (!isHost || !botsInGame || finished) return;
    let delay = 700 + Math.random() * 600;
    if (room.game === "reaction") {
      if (state.phase !== "waiting") return;
      delay = Math.max(300, state.goAt - (Date.now() + offset) + 250 + Math.random() * 250);
    }
    const t = setTimeout(() => {
      botStep({ data: { roomId: room.id } }).catch(() => {});
    }, delay);
    return () => clearTimeout(t);
  }, [room.version, isHost, botsInGame, finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const scoreOf = (p: PlayerRow) => (room.game === "tictactoe" ? p.wins : (state.scores?.[p.user_id] ?? 0));
  const turnId = state.turn ?? state.presenter;
  const won = finished?.winners.includes(me);
  const previous = useRef<any>(null);
  useEffect(() => {
    const prev = previous.current;
    if (prev) {
      if (finished && !prev.finished) playSound(won ? "win" : "round");
      else if ((state.scores?.[me] ?? 0) > (prev.scores?.[me] ?? 0)) playSound("success");
      else if (state.phase !== prev.phase || state.turn !== prev.turn || state.game !== prev.game || state.last?.n !== prev.last?.n) playSound("round");
    } else playSound("round");
    previous.current = state;
  }, [state, finished, won, me]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-ink text-2xl ${info.color}`}>{info.emoji}</span>
          <div>
            <h1 className="text-2xl font-extrabold leading-none">{info.name}</h1>
            <p className="text-sm text-muted-foreground">Sala {room.code}{spectator && " · assistindo"}</p>
          </div>
        </div>
        {isHost && !finished && (
          <Button variant="popPlain" size="sm" disabled={busy} onClick={() => doRematch(false)}><RotateCcw /> Reiniciar</Button>
        )}
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {inGame.map((p) => (
          <div key={p.user_id} className={cn("flex min-w-fit items-center gap-2 rounded-2xl border-2 border-ink bg-card py-1.5 pl-1.5 pr-4 shadow-pop-sm", turnId === p.user_id && !finished && "bg-accent")}>
            <PlayerAvatar photoPath={p.photo_path} avatar={p.avatar} size={38} ring={turnId === p.user_id && !finished} />
            <div className="leading-tight">
              <p className="text-sm font-bold">{p.nickname}{p.user_id === me && " (você)"}</p>
              <p className="font-display text-lg font-extrabold">{scoreOf(p)} <span className="text-xs font-normal">{room.game === "tictactoe" ? "vitórias" : "pts"}</span></p>
            </div>
            {!isOnline(p) && <WifiOff className="h-4 w-4 text-muted-foreground" aria-label="offline" />}
          </div>
        ))}
      </div>

      <div className={cn(finished && "pointer-events-none opacity-60")}>
        <UI state={state} players={inGame} me={me} act={act} offset={offset} secrets={secrets} />
      </div>

      {finished && (
        <>
          {won && <Confetti />}
          <div className="fixed inset-x-0 bottom-0 z-50 p-4">
            <div className={cn("animate-pop-in mx-auto max-w-md rounded-3xl border-2 border-ink bg-card p-5 text-center shadow-pop", !won && finished.winners.length > 0 && "animate-shake")}>
              <p className="text-4xl">{won ? "🏆" : finished.winners.length ? "😵" : "🤝"}</p>
              <p className="font-display text-3xl font-extrabold">{won ? "Você venceu!" : finished.winners.length ? (spectator ? "Fim de jogo!" : "Não foi dessa vez!") : "Empate!"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{finished.summary}</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button variant="pop" disabled={busy} onClick={() => doRematch(false)}><RotateCcw /> Revanche</Button>
                <Button variant="popPlain" disabled={busy} onClick={() => doRematch(true)}><Home /> Voltar ao lobby</Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
