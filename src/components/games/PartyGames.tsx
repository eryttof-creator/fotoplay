import { useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { GameProps } from "./Games";
import { STOP_CATEGORIES } from "@/lib/games/engine";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";

const name = (p: GameProps, id: string) => p.players.find((player) => player.user_id === id)?.nickname ?? "?";
function useClock(p: GameProps, running: boolean) {
  const [left, setLeft] = useState(0);
  const fired = useRef(0);
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((p.state.endsAt - Date.now() - p.offset) / 1000));
      setLeft(seconds);
      if (!seconds && fired.current !== p.state.endsAt) { fired.current = p.state.endsAt; void p.act("timeout"); }
    };
    tick(); const timer = setInterval(tick, 500); return () => clearInterval(timer);
  }, [p.state.endsAt, running, p.offset, p.act]);
  useEffect(() => { if (running && left > 0 && left <= 5) playSound("tick"); }, [left, running]);
  return left;
}
function Next({ p }: { p: GameProps }) { return !p.state.finished && <Button variant="pop" onClick={() => p.act("next")}>Próxima rodada</Button>; }

export function Stop(p: GameProps) {
  const { state: s, me, act } = p;
  const [answers, setAnswers] = useState<string[]>(STOP_CATEGORIES.map(() => ""));
  const left = useClock(p, s.phase === "writing" && !s.finished);
  const queue = useRef(Promise.resolve());
  useEffect(() => { setAnswers(STOP_CATEGORIES.map(() => "")); }, [s.game]);
  function save(values: string[]) { queue.current = queue.current.then(async () => { await act("save", { answers: values }); }); }
  return <div className="mx-auto max-w-2xl space-y-4">
    <div className="flex items-center justify-between"><span className="font-bold">Rodada {s.game} / {s.maxGames}</span><span className="font-display text-2xl font-bold">Letra {s.letter}</span><span>{s.phase === "writing" ? `${left}s` : "Stop!"}</span></div>
    {s.phase === "writing" ? <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await queue.current; await act("stop", { answers }); }}>
      {STOP_CATEGORIES.map((category, i) => <label key={category} className="block space-y-1"><span className="text-sm font-bold">{category}</span><Input aria-label={category} maxLength={40} value={answers[i]} onChange={(e) => { const values = [...answers]; values[i] = e.target.value; setAnswers(values); }} onBlur={() => save(answers)} /></label>)}
      <div className="flex flex-wrap gap-2"><Button variant="popPlain" onClick={() => save(answers)}>Salvar respostas</Button><Button variant="popLime" type="submit">STOP!</Button></div>
      <p className="text-sm text-muted-foreground">{Object.keys(s.submitted).length}/{p.players.length} enviaram respostas</p>
    </form> : <><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Jogador</th>{STOP_CATEGORIES.map((c) => <th key={c} className="p-2 text-left">{c}</th>)}</tr></thead><tbody>{p.players.map((player) => <tr key={player.user_id} className={cn("border-b border-border", player.user_id === me && "bg-accent")}><th className="p-2 text-left">{player.nickname}</th>{s.answers[player.user_id]?.map((a: string, i: number) => <td key={i} className="p-2">{a || "—"}<span className="block text-xs text-muted-foreground">+{s.points[player.user_id]?.[i] ?? 0}</span></td>)}</tr>)}</tbody></table></div><Next p={p} /></>}
  </div>;
}

export function Quiz(p: GameProps) {
  const { state: s, me, act } = p;
  return <div className="mx-auto max-w-xl space-y-5 text-center"><p className="text-sm text-muted-foreground">Rodada {s.game} / 5</p><h2 className="font-display text-2xl font-bold">{s.prompt}</h2>
    <div className="grid grid-cols-2 gap-3">{p.players.map((player) => <Button key={player.user_id} variant={s.leaders.includes(player.user_id) ? "popLime" : "popPlain"} className="h-auto min-h-28 flex-col whitespace-normal py-4" disabled={s.phase !== "voting" || !!s.voted[me] || !!s.finished} onClick={() => act("vote", { target: player.user_id })}><PlayerAvatar photoPath={player.photo_path} avatar={player.avatar} size={48} /><span className="break-words">{player.nickname}</span></Button>)}</div>
    {s.phase === "voting" ? <p>{s.voted[me] ? "Seu voto foi enviado!" : "Quem você escolhe?"} · {Object.keys(s.voted).length}/{p.players.length}</p> : <><p className="font-bold">A galera escolheu: {s.leaders.map((id: string) => name(p, id)).join(" e ")}!</p><div className="space-y-1 text-sm">{Object.entries(s.votes).map(([id, target]) => <p key={id}>{name(p, id)} → {name(p, String(target))}</p>)}</div><Next p={p} /></>}
  </div>;
}

export function Truth(p: GameProps) {
  const { state: s, me, act } = p;
  const [statement, setStatement] = useState("");
  const [truth, setTruth] = useState(true);
  useEffect(() => { setStatement(""); setTruth(true); }, [s.turn]);
  const mine = s.presenter === me;
  return <div className="mx-auto max-w-xl space-y-4 text-center"><p className="font-bold">Vez de {name(p, s.presenter)}</p>
    {s.phase === "prepare" ? mine ? <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void act("present", { statement, truth }); }}><Input aria-label="Sua história" placeholder="Uma vez eu…" value={statement} onChange={(e) => setStatement(e.target.value)} maxLength={180} /><div className="flex justify-center gap-2"><Button variant={truth ? "popLime" : "popPlain"} aria-pressed={truth} onClick={() => setTruth(true)}>Verdade</Button><Button variant={!truth ? "pop" : "popPlain"} aria-pressed={!truth} onClick={() => setTruth(false)}>Mentira</Button></div><Button type="submit" variant="pop">Contar história</Button></form> : <p className="text-muted-foreground">Preparando a história…</p> : <><h2 className="break-words font-display text-2xl font-bold">“{s.statement}”</h2>
      {s.phase === "voting" ? <>{!mine && !s.voted[me] && <div className="flex justify-center gap-2"><Button variant="popLime" onClick={() => act("vote", { truth: true })}>Verdade</Button><Button variant="pop" onClick={() => act("vote", { truth: false })}>Mentira</Button></div>}<p className="text-sm">{Object.keys(s.voted).length}/{p.players.length - 1} votos</p></> : <><p className="font-display text-2xl font-bold">{s.answer ? "Era verdade! ✅" : "Era mentira! 🤥"}</p>{Object.entries(s.votes).map(([id, vote]) => <p key={id}>{name(p, id)}: {vote === s.answer ? "acertou! +1" : "caiu nessa!"}</p>)}<Next p={p} /></>}
    </>}
  </div>;
}

type Stroke = { points: number[][]; color: string };
const colors = ["ink", "coral", "sky", "lime"];
const colorClasses: Record<string, string> = { ink: "bg-ink", coral: "bg-coral", sky: "bg-sky", lime: "bg-lime" };
const labels: Record<string, string> = { ink: "Tinta", coral: "Coral", sky: "Azul", lime: "Verde" };
export function Draw(p: GameProps) {
  const { state: s, me, act } = p;
  const [word, setWord] = useState(""); const [guess, setGuess] = useState(""); const [color, setColor] = useState("ink");
  const [local, setLocal] = useState<Stroke[]>([]); const [active, setActive] = useState<Stroke | null>(null);
  const activeRef = useRef<Stroke | null>(null); const canvas = useRef<HTMLCanvasElement>(null);
  const mine = s.presenter === me; const left = useClock(p, s.phase === "drawing" && !s.finished);
  const queue = useRef(Promise.resolve());
  useEffect(() => { setWord(""); setGuess(""); setLocal([]); setActive(null); activeRef.current = null; }, [s.turn]);
  useEffect(() => {
    const node = canvas.current; if (!node) return;
    const ctx = node.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, node.width, node.height); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 5;
    const styles = getComputedStyle(node);
    const strokes: Stroke[] = [...s.strokes, ...local, ...(active ? [active] : [])];
    strokes.forEach((stroke) => { ctx.strokeStyle = styles.getPropertyValue(`--${stroke.color}`).trim(); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); stroke.points.forEach(([x = 0, y = 0], i) => { if (!i) ctx.moveTo(x * 800, y * 500); else ctx.lineTo(x * 800, y * 500); }); if (stroke.points.length === 1) { const point = stroke.points[0]; if (point) { ctx.arc((point[0] ?? 0) * 800, (point[1] ?? 0) * 500, 2.5, 0, Math.PI * 2); ctx.fill(); } } else ctx.stroke(); });
  }, [s.strokes, local, active]);
  function point(e: React.PointerEvent<HTMLCanvasElement>) { const rect = e.currentTarget.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))]; }
  function finish() { const stroke = activeRef.current; if (!stroke) return; activeRef.current = null; setActive(null); setLocal((old) => [...old, stroke]); queue.current = queue.current.then(async () => { await act("stroke", stroke); setLocal((old) => old.filter((item) => item !== stroke)); }); }
  return <div className="mx-auto max-w-2xl space-y-4"><div className="flex justify-between gap-2"><p className="font-bold">{name(p, s.presenter)} desenha</p>{s.phase === "drawing" && <span>{left}s</span>}</div>
    {s.phase === "prepare" ? mine ? <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void act("present", { word }); }}><Input aria-label="Palavra secreta" placeholder="Palavra secreta" value={word} maxLength={40} onChange={(e) => setWord(e.target.value)} /><Button variant="pop" type="submit">Começar</Button></form> : <p>Escolhendo a palavra…</p> : <>
      <canvas ref={canvas} width={800} height={500} aria-label="Desenho da rodada" className={cn("aspect-[8/5] w-full rounded-2xl border-2 border-ink bg-card", mine && "touch-none cursor-crosshair")} onPointerDown={(e) => { if (!mine || s.phase !== "drawing" || s.finished) return; e.currentTarget.setPointerCapture(e.pointerId); const stroke = { color, points: [point(e)] }; activeRef.current = stroke; setActive(stroke); }} onPointerMove={(e) => { const stroke = activeRef.current; if (!stroke) return; const updated = { ...stroke, points: [...stroke.points, point(e)].slice(-100) }; activeRef.current = updated; setActive(updated); }} onPointerUp={finish} onPointerCancel={finish} />
      {mine && s.phase === "drawing" && <div className="flex flex-wrap items-center gap-2">{colors.map((c) => <Button key={c} variant="outline" size="icon" title={labels[c]} aria-label={labels[c]} aria-pressed={color === c} className={cn("rounded-full border-2", color === c && "ring-2 ring-ring")} onClick={() => setColor(c)}><span className={cn("h-5 w-5 rounded-full", colorClasses[c])} /></Button>)}<Button variant="popPlain" aria-label="Limpar desenho" title="Limpar desenho" onClick={async () => { await queue.current; await act("erase"); }}><Trash2 /></Button></div>}
      {s.phase === "drawing" && !mine && !s.guessed[me] && <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await act("guess", { text: guess })) setGuess(""); }}><Input aria-label="Seu palpite" placeholder="Seu palpite…" value={guess} maxLength={40} onChange={(e) => setGuess(e.target.value)} /><Button variant="pop" type="submit" aria-label="Enviar palpite"><Send /></Button></form>}
      {s.phase === "drawing" && s.guessed[me] && <p className="font-bold text-success">Você acertou! +3 pontos</p>}
      {s.phase === "reveal" && <div className="space-y-3 text-center"><p className="font-display text-2xl font-bold">Era: {s.answer}</p><Next p={p} /></div>}
      <div className="max-h-40 overflow-y-auto text-sm">{s.feed.map((f: any, i: number) => <p key={i} className={cn("py-1", f.ok && "font-bold text-success")}>{name(p, f.uid)}: {f.text}</p>)}</div>
    </>}
  </div>;
}
export function Mime(p: GameProps) {
  const { state: s, me, act } = p;
  const left = useClock(p, s.phase === "acting" && !s.finished);
  const [guess, setGuess] = useState("");
  const mine = s.presenter === me;
  useEffect(() => { setGuess(""); }, [s.turn]);
  return <div className="mx-auto max-w-xl space-y-4 text-center">
    <p className="font-bold">Rodada {s.turn + 1} / {s.order.length} · {name(p, s.presenter)} faz a mímica</p>
    {s.phase === "acting" ? <>
      <p className="rounded-2xl bg-sun p-3 font-display text-lg font-bold">{left}s</p>
      {mine ? <div className="rounded-3xl border-2 border-ink bg-accent p-5 shadow-pop-sm"><p>Sua palavra:</p><p className="font-display text-2xl font-extrabold">{p.secrets[me]?.word ?? "Carregando…"}</p><p className="mt-2 text-sm">Faça gestos sem falar nem desenhar.</p></div> : <><p className="text-muted-foreground">{name(p, s.presenter)} está fazendo mímica…</p><form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (guess.trim() && await act("guess", { text: guess })) setGuess(""); }}><Input aria-label="Seu palpite" placeholder="O que está representando?" value={guess} maxLength={60} onChange={(e) => setGuess(e.target.value)} /><Button type="submit" variant="pop" aria-label="Enviar palpite"><Send /></Button></form></>}
      <div className="flex max-h-40 flex-col-reverse gap-1 overflow-y-auto text-left text-sm">{[...s.feed].reverse().map((f: any, i: number) => <p key={i} className={cn("rounded-xl px-3 py-1.5", f.ok ? "bg-accent font-bold" : "bg-muted")}>{name(p, f.uid)}: {f.ok ? "acertou!" : f.text}</p>)}</div>
    </> : <div className="space-y-3 rounded-3xl border-2 border-ink bg-accent p-5 text-center shadow-pop-sm"><p>A palavra era</p><p className="font-display text-2xl font-extrabold">{s.answer}</p><Next p={p} /></div>}
  </div>;
}

const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
export function Hangman(p: GameProps) {
  const { state: s, me, act } = p;
  const [word, setWord] = useState("");
  const mine = s.presenter === me;
  const myTurn = s.phase === "guessing" && !mine && s.order[s.turn] === me;
  useEffect(() => { setWord(""); }, [s.roundIndex]);
  if (s.phase === "prepare") return <div className="mx-auto max-w-xl space-y-4 text-center">
    <p className="font-bold">Rodada {s.roundIndex + 1} / {s.order.length} · vez de {name(p, s.presenter)}</p>
    {mine ? <form className="mx-auto flex max-w-sm gap-2" onSubmit={(e) => { e.preventDefault(); void act("present", { word }); }}><Input aria-label="Palavra secreta" placeholder="Escolha uma palavra" value={word} maxLength={40} onChange={(e) => setWord(e.target.value)} /><Button type="submit" variant="pop">Começar</Button></form> : <p className="text-muted-foreground">{name(p, s.presenter)} está escolhendo a palavra…</p>}
  </div>;
  if (s.phase === "reveal") return <div className="mx-auto max-w-xl space-y-4 text-center">
    <p className="font-bold">A palavra era</p><p className="font-display text-3xl font-extrabold">{s.answer}</p><p>{s.wrong} erro(s) de 6</p><Next p={p} />
  </div>;
  return <div className="mx-auto max-w-xl space-y-4 text-center">
    <p className="font-bold">Forca · rodada {s.roundIndex + 1} / {s.order.length}</p>
    <p className="break-all font-mono text-3xl font-extrabold tracking-[0.25em]" aria-label="Palavra oculta">{s.pattern.replace(/_/g, "＿")}</p>
    <p>Erros: {s.wrong} / 6 · Letras: {s.letters.length ? s.letters.map((v: string) => v.toUpperCase()).join(" ") : "nenhuma"}</p>
    {mine ? <p className="rounded-xl bg-accent p-3">Sua palavra: <b>{p.secrets[me]?.word ?? "…"}</b></p> : <p>{myTurn ? "Sua vez: escolha uma letra." : "Vez de " + name(p, s.order[s.turn])}</p>}
    <div className="grid grid-cols-7 gap-2">{alphabet.map((letter) => <Button key={letter} type="button" variant={s.letters.includes(letter) ? "outline" : "popPlain"} size="sm" disabled={!myTurn || s.letters.includes(letter)} onClick={() => void act("guessLetter", { letter })}>{letter.toUpperCase()}</Button>)}</div>
  </div>;
}