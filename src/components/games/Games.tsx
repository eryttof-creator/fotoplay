import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Timer, ImagePlus, Check, X as XIcon, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { useSignedUrl, compressImage, uploadPhoto } from "@/lib/photos";
import { AVATARS } from "@/lib/games/catalog";
import type { PlayerRow } from "@/lib/useRoom";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";

export interface GameProps {
  state: any;
  players: PlayerRow[];
  me: string;
  act: (type: string, payload?: Record<string, unknown>) => Promise<boolean>;
  offset: number;
  secrets: Record<string, any>;
}
const byId = (ps: PlayerRow[], id: string) => ps.find((p) => p.user_id === id);
const name = (ps: PlayerRow[], id: string) => byId(ps, id)?.nickname ?? "?";

function TurnBanner({ mine, who }: { mine: boolean; who: string }) {
  return (
    <div className={cn("mx-auto mb-5 w-fit rounded-full border-2 border-ink px-4 py-1.5 font-display font-bold shadow-pop-sm", mine ? "bg-accent" : "bg-card")}>
      {mine ? "Sua vez!" : `Vez de ${who}`}
    </div>
  );
}

/* ---------------- Jogo da Velha ---------------- */
export function TicTacToe({ state, players, me, act }: GameProps) {
  const mine = state.turn === me && !state.finished;
  const x = byId(players, state.xId);
  const o = byId(players, state.oId);
  return (
    <div>
      {!state.finished && <TurnBanner mine={mine} who={name(players, state.turn)} />}
      <div className="mx-auto grid aspect-square w-full max-w-[360px] grid-cols-3 gap-2.5 rounded-3xl border-2 border-ink bg-ink p-2.5 shadow-pop">
        {state.board.map((cell: string | null, i: number) => {
          const p = cell ? byId(players, cell) : null;
          const isX = cell === state.xId;
          const win = state.line?.includes(i);
          return (
            <button
              key={i}
              aria-label={`Casa ${i + 1}`}
              disabled={!mine || !!cell}
              onClick={() => act("move", { i })}
              className={cn(
                "relative flex items-center justify-center rounded-2xl bg-card transition-colors",
                mine && !cell && "hover:bg-muted",
                win && "bg-accent",
              )}
            >
              {cell && (
                <div className="animate-pop-in relative">
                  <PlayerAvatar photoPath={p?.photo_path} avatar={p?.avatar} size={76} className={cn("border-4", isX ? "border-coral" : "border-sky")} />
                  <span className={cn("absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink text-xs font-black", isX ? "bg-coral text-primary-foreground" : "bg-sky")}>
                    {isX ? "X" : "O"}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <b>{x?.nickname}</b> é o X · <b>{o?.nickname}</b> é a bola
      </p>
    </div>
  );
}

/* ---------------- Memória ---------------- */
function Face({ face, players }: { face: any; players: PlayerRow[] }) {
  if (face?.k === "photo") {
    const p = byId(players, face.uid);
    return <PlayerAvatar photoPath={p?.photo_path} avatar={p?.avatar} square size={999} className="!h-full !w-full border-0" />;
  }
  return <div className={`av-${face?.key} flex h-full w-full items-center justify-center text-4xl`}>{AVATARS[face?.key]}</div>;
}
export function Memory({ state, players, me, act }: GameProps) {
  const mine = state.turn === me && !state.finished;
  const [hidden, setHidden] = useState<number[]>([]);
  const key = state.mismatch.join(",");
  useEffect(() => {
    setHidden([]);
    if (!state.mismatch.length) return;
    const t = setTimeout(() => setHidden(state.mismatch), 1400);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      {!state.finished && <TurnBanner mine={mine} who={name(players, state.turn)} />}
      <div className="mx-auto grid w-full max-w-[440px] grid-cols-4 gap-2">
        {state.revealed.map((face: any, i: number) => {
          const up = !!face && !hidden.includes(i);
          const owner = state.matchedBy[i];
          return (
            <button
              key={i}
              aria-label={`Carta ${i + 1}`}
              disabled={!mine || !!owner || state.flipped.includes(i)}
              onClick={() => act("flip", { i })}
              className="relative aspect-square [perspective:600px]"
            >
              <div className={cn("flip-card relative h-full w-full", up && "is-flipped")}>
                <div className="flip-face flex items-center justify-center rounded-2xl border-2 border-ink bg-primary font-display text-xl font-extrabold text-primary-foreground shadow-pop-sm">
                  FP
                </div>
                <div className={cn("flip-face flip-back overflow-hidden rounded-2xl border-2 border-ink bg-card", owner && "ring-4 ring-lime")}>
                  {face && <Face face={face} players={players} />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Pedra, Papel e Tesoura ---------------- */
const RPS: Record<string, string> = { pedra: "✊", papel: "✋", tesoura: "✌️" };
export function RockPaperScissors({ state, players, me, act }: GameProps) {
  const picked = !!state.picked[me];
  return (
    <div className="flex flex-col items-center gap-6">
      <p className="font-display text-lg font-bold">Primeiro a {state.target} pontos vence</p>
      {state.last && (
        <div key={state.last.n} className="animate-pop-in flex flex-wrap justify-center gap-4 rounded-3xl border-2 border-ink bg-card p-4 shadow-pop-sm">
          {players.map((p) => (
            <div key={p.user_id} className={cn("flex flex-col items-center gap-1 rounded-2xl p-2", state.last.winners.includes(p.user_id) && "bg-accent")}>
              <PlayerAvatar photoPath={p.photo_path} avatar={p.avatar} size={52} />
              <span className="text-4xl">{RPS[state.last.choices[p.user_id]]}</span>
              <span className="text-xs font-medium">{p.nickname}</span>
            </div>
          ))}
          <p className="w-full text-center text-sm font-bold">
            {state.last.winners.length ? `Ponto para ${state.last.winners.map((w: string) => name(players, w)).join(", ")}!` : "Empate na rodada!"}
          </p>
        </div>
      )}
      <div className="flex gap-3">
        {Object.entries(RPS).map(([k, e]) => (
          <button
            key={k}
            disabled={picked || state.finished}
            onClick={() => act("pick", { c: k })}
            className="press flex h-24 w-24 flex-col items-center justify-center rounded-3xl border-2 border-ink bg-card text-5xl shadow-pop disabled:opacity-50"
          >
            {e}
            <span className="text-xs font-bold capitalize">{k}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2 text-sm">
        {players.map((p) => (
          <span key={p.user_id} className={cn("rounded-full border-2 border-ink px-3 py-1", state.picked[p.user_id] ? "bg-accent" : "bg-muted")}>
            {p.nickname}: {state.picked[p.user_id] ? "escolheu ✓" : "pensando…"}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Batalha de Reação ---------------- */
export function Reaction({ state, players, me, act, offset }: GameProps) {
  const [go, setGo] = useState(false);
  const shownAt = useRef(0);
  const myResult = state.results[me];
  useEffect(() => {
    setGo(false);
    if (state.phase !== "waiting") return;
    const delay = state.goAt - (Date.now() + offset);
    const t = setTimeout(() => {
      shownAt.current = performance.now();
      setGo(true);
      playSound("tick");
    }, Math.max(0, delay));
    return () => clearTimeout(t);
  }, [state.phase, state.goAt, offset]);

  const hit = () => {
    if (state.phase !== "waiting" || myResult !== undefined) return;
    if (!go) act("hit", { early: true, ms: 0 });
    else act("hit", { ms: performance.now() - shownAt.current });
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="font-display text-lg font-bold">Rodada {Math.min(state.game, state.maxGames)} de {state.maxGames}</p>
      {state.phase === "waiting" ? (
        <button
          onPointerDown={hit}
          className={cn(
            "flex aspect-square w-full max-w-[340px] select-none flex-col items-center justify-center rounded-[2.5rem] border-4 border-ink font-display text-4xl font-extrabold shadow-pop transition-colors",
            myResult !== undefined ? "bg-muted" : go ? "bg-success" : "bg-destructive text-destructive-foreground",
          )}
        >
          {myResult === "early" ? "Queimou! 😬" : typeof myResult === "number" ? `${myResult} ms` : go ? "⚡ AGORA!" : "Espere…"}
          {myResult !== undefined && <span className="mt-2 text-base font-medium">Aguardando os outros…</span>}
        </button>
      ) : (
        <div className="flex w-full max-w-[340px] flex-col gap-3">
          {state.phase === "result" && (
            <div className="rounded-3xl border-2 border-ink bg-card p-4 shadow-pop-sm">
              {players
                .slice()
                .sort((a, b) => (typeof state.results[a.user_id] === "number" ? state.results[a.user_id] : 1e9) - (typeof state.results[b.user_id] === "number" ? state.results[b.user_id] : 1e9))
                .map((p, i) => (
                  <div key={p.user_id} className="flex items-center gap-3 py-1.5">
                    <span className="w-5 font-bold">{i + 1}</span>
                    <PlayerAvatar photoPath={p.photo_path} avatar={p.avatar} size={32} />
                    <span className="flex-1">{p.nickname}</span>
                    <span className="font-display font-bold">{state.results[p.user_id] === "early" ? "queimou" : `${state.results[p.user_id]} ms`}</span>
                  </div>
                ))}
            </div>
          )}
          {!state.finished && (
            <Button variant="pop" size="xl" onClick={() => act("start")}>
              {state.phase === "idle" ? "Começar!" : "Próxima rodada"}
            </Button>
          )}
          <p className="text-center text-sm text-muted-foreground">Quando a tela ficar verde, toque o mais rápido possível. Tocar antes queima a rodada.</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- Adivinhe a Foto ---------------- */
function useCountdown(endsAt: number, offset: number) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - (Date.now() + offset)) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [endsAt, offset]);
  return left;
}
export function GuessPhoto({ state, players, me, act, offset }: GameProps) {
  const isPresenter = state.presenter === me;
  const url = useSignedUrl(state.photoPath);
  const left = useCountdown(state.endsAt, offset);
  const [file, setFile] = useState<File | null>(null);
  const [answer, setAnswer] = useState("");
  const [hint, setHint] = useState("");
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const fired = useRef("");

  useEffect(() => {
    if (state.phase === "guessing" && left === 0 && state.endsAt && fired.current !== state.photoPath) {
      fired.current = state.photoPath;
      setTimeout(() => act("timeout").catch(() => {}), 400 + Math.random() * 600);
    }
  }, [left, state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const presenter = name(players, state.presenter);
  if (state.phase === "upload") {
    if (!isPresenter)
      return (
        <div className="mx-auto max-w-sm rounded-3xl border-2 border-ink bg-card p-6 text-center shadow-pop-sm">
          <Loader2 className="mx-auto mb-3 animate-spin" />
          <p className="font-display text-lg font-bold">{presenter} está escolhendo uma foto…</p>
        </div>
      );
    return (
      <form
        className="mx-auto flex max-w-sm flex-col gap-3 rounded-3xl border-2 border-ink bg-card p-5 shadow-pop-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!file) {
            toast.error("Escolha uma imagem.");
            return;
          }
          setBusy(true);
          try {
            const blob = await compressImage(file);
            const path = await uploadPhoto(me, blob, "round");
            await act("present", { path, answer, hint });
          } catch {
            toast.error("Não foi possível enviar a imagem.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="font-display text-xl font-bold">Sua vez de apresentar!</p>
        <p className="text-sm text-muted-foreground">Envie uma foto e escreva a resposta (o que é, ou de quem é). Os outros têm 60 segundos.</p>
        <label className="press flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink p-4 font-medium">
          <ImagePlus className="h-5 w-5" /> {file ? file.name : "Escolher imagem"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <Input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Resposta certa (ex.: Meu cachorro Bob)" maxLength={60} className="h-11 rounded-xl border-2" />
        <Input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Dica (opcional)" maxLength={80} className="h-11 rounded-xl border-2" />
        <Button type="submit" variant="pop" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Enviar foto</Button>
      </form>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div className="flex items-center justify-between text-sm">
        <span>Foto de <b>{presenter}</b></span>
        {state.phase === "guessing" && (
          <span className={cn("flex items-center gap-1 rounded-full border-2 border-ink px-3 py-1 font-display font-bold", left <= 10 ? "bg-destructive text-destructive-foreground" : "bg-sun")}>
            <Timer className="h-4 w-4" /> {left}s
          </span>
        )}
      </div>
      <div className="overflow-hidden rounded-3xl border-2 border-ink bg-muted shadow-pop">
        {url ? (
          <img
            src={url}
            alt="Foto para adivinhar"
            className="max-h-[50vh] w-full object-contain transition-[filter] duration-1000"
            style={{
              filter:
                state.phase === "guessing" && !isPresenter
                  ? `blur(${Math.round((Math.min(left, 60) / 60) * 18)}px)`
                  : "none",
            }}
          />
        ) : (
          <div className="flex h-60 items-center justify-center"><Loader2 className="animate-spin" /></div>
        )}
      </div>
      {state.phase === "guessing" && !isPresenter && (
        <p className="text-center text-xs text-muted-foreground">A foto vai ficando mais nítida com o tempo…</p>
      )}
      {state.hint && <p className="text-center text-sm">💡 {state.hint}</p>}
      {state.phase === "reveal" ? (
        <div className="animate-pop-in rounded-3xl border-2 border-ink bg-accent p-4 text-center shadow-pop-sm">
          <p className="text-sm">A resposta era</p>
          <p className="font-display text-2xl font-extrabold">{state.answer}</p>
          {!state.finished && <Button variant="pop" className="mt-3" onClick={() => act("next")}>Próxima foto</Button>}
        </div>
      ) : isPresenter ? (
        <p className="text-center text-sm text-muted-foreground">Você ganha 1 ponto para cada pessoa que acertar.</p>
      ) : state.guessed[me] ? (
        <p className="rounded-2xl bg-accent p-3 text-center font-bold">Você acertou! +{state.guessed[me]} pts</p>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!guess.trim()) return;
            await act("guess", { text: guess });
            setGuess("");
          }}
        >
          <Input value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Seu palpite…" maxLength={60} className="h-12 rounded-xl border-2" />
          <Button type="submit" variant="pop" className="h-12" aria-label="Enviar palpite"><Send /></Button>
        </form>
      )}
      <div className="flex max-h-40 flex-col-reverse gap-1 overflow-y-auto text-sm">
        {[...state.feed].reverse().map((f: any, i: number) => (
          <div key={i} className={cn("rounded-xl px-3 py-1.5", f.ok ? "bg-accent font-bold" : "bg-muted")}>
            {name(players, f.uid)}: {f.ok ? `acertou! +${f.pts}` : f.text}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Quem Sou Eu? ---------------- */
const ANS: Record<string, string> = { sim: "Sim", nao: "Não", talvez: "Talvez" };
export function WhoAmI({ state, players, me, act, secrets }: GameProps) {
  const [q, setQ] = useState("");
  const [g, setG] = useState("");
  const mine = state.turn === me && !state.finished;
  const asker = name(players, state.turn);
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {players.map((p) => {
          const char = state.revealed?.[p.user_id] ?? (p.user_id === me ? state.solved[me] ?? null : secrets[p.user_id]?.name);
          return (
            <div key={p.user_id} className={cn("flex flex-col items-center gap-1 rounded-2xl border-2 border-ink bg-card p-3 text-center shadow-pop-sm", state.turn === p.user_id && "bg-accent")}>
              <PlayerAvatar photoPath={p.photo_path} avatar={p.avatar} size={48} />
              <span className="text-xs">{p.nickname}{p.user_id === me && " (você)"}</span>
              <span className="font-display text-sm font-bold">{char ?? "???"}</span>
              {state.solved[p.user_id] && <span className="text-xs font-bold text-success">descobriu ✓</span>}
            </div>
          );
        })}
      </div>
      {!state.finished && <TurnBanner mine={mine} who={asker} />}
      {!state.finished && state.phase === "ask" && mine && (
        <div className="flex flex-col gap-3 rounded-3xl border-2 border-ink bg-card p-4 shadow-pop-sm">
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await act("ask", { q })) setQ(""); }}>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Eu sou uma pessoa real?" maxLength={120} className="h-11 rounded-xl border-2" />
            <Button type="submit" variant="pop" className="h-11"><HelpCircle /> Perguntar</Button>
          </form>
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (g.trim() && (await act("guess", { name: g }))) setG(""); }}>
            <Input value={g} onChange={(e) => setG(e.target.value)} placeholder="Já sei! Eu sou…" maxLength={40} className="h-11 rounded-xl border-2" />
            <Button type="submit" variant="popLime" className="h-11">Chutar</Button>
          </form>
        </div>
      )}
      {!state.finished && state.phase === "ask" && !mine && (
        <p className="text-center text-sm text-muted-foreground">{asker} está pensando na pergunta…</p>
      )}
      {!state.finished && state.phase === "answer" && (
        <div className="animate-pop-in rounded-3xl border-2 border-ink bg-card p-4 text-center shadow-pop-sm">
          <p className="text-sm text-muted-foreground">{asker} perguntou:</p>
          <p className="font-display text-xl font-bold">“{state.question}”</p>
          {!mine && !state.answers[me] && (
            <div className="mt-3 flex justify-center gap-2">
              <Button variant="popLime" onClick={() => act("answer", { a: "sim" })}><Check /> Sim</Button>
              <Button variant="pop" onClick={() => act("answer", { a: "nao" })}><XIcon /> Não</Button>
              <Button variant="popPlain" onClick={() => act("answer", { a: "talvez" })}>Talvez</Button>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {Object.keys(state.answers).length}/{players.length - 1} responderam
          </p>
        </div>
      )}
      <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto text-sm">
        {[...state.log].reverse().map((l: any, i: number) => (
          <div key={i} className="rounded-xl bg-muted px-3 py-2">
            <b>{name(players, l.uid)}</b>{" "}
            {l.q ? (
              <>perguntou “{l.q}” — {Object.entries(l.answers).map(([u, a]) => `${name(players, u)}: ${ANS[a as string]}`).join(" · ")}</>
            ) : (
              <>chutou “{l.guess}” {l.ok ? "e ACERTOU! 🎉" : "e errou"}</>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
