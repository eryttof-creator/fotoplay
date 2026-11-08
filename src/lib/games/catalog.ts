import type { GameId } from "./engine";
import { GAME_LIMITS } from "./engine";

export const AVATARS: Record<string, string> = {
  a1: "🦊", a2: "🐼", a3: "🐸", a4: "🐙", a5: "🦄", a6: "🐯",
  a7: "🐵", a8: "🐧", a9: "🦖", a10: "🐝", a11: "🐨", a12: "🐰",
};

export const GAMES: { id: GameId; name: string; emoji: string; tagline: string; color: string }[] = [
  { id: "tictactoe", name: "Jogo da Velha", emoji: "❌", tagline: "Sua foto é o X. A do seu amigo, a bola.", color: "bg-coral" },
  { id: "memory", name: "Jogo da Memória", emoji: "🃏", tagline: "Ache os pares com as caras da galera.", color: "bg-sky" },
  { id: "rps", name: "Pedra, Papel e Tesoura", emoji: "✌️", tagline: "Escolhas reveladas ao mesmo tempo.", color: "bg-lime" },
  { id: "guess", name: "Adivinhe a Foto", emoji: "🔍", tagline: "Mande uma foto. Quem acerta primeiro?", color: "bg-sun" },
  { id: "whoami", name: "Quem Sou Eu?", emoji: "🎭", tagline: "Pergunte sim ou não e descubra quem é.", color: "bg-coral" },
  { id: "reaction", name: "Batalha de Reação", emoji: "⚡", tagline: "Clique no sinal mais rápido que todos.", color: "bg-sky" },
  { id: "stop", name: "Stop (Adedonha)", emoji: "✍️", tagline: "Uma letra, cinco categorias e uma corrida.", color: "bg-lime" },
  { id: "quiz", name: "Quiz da Galera", emoji: "💬", tagline: "Quem é mais provável? A galera decide.", color: "bg-sun" },
  { id: "draw", name: "Desenhe e Adivinhe", emoji: "🎨", tagline: "Um desenha, os outros dão seus palpites.", color: "bg-coral" },
  { id: "truth", name: "Verdade ou Mentira", emoji: "🤥", tagline: "Histórias da galera: será que aconteceu?", color: "bg-sky" },
];

export const gameInfo = (id: string) => GAMES.find((g) => g.id === id) ?? GAMES[0]!;
export const playersLabel = (id: GameId) => {
  const l = GAME_LIMITS[id];
  return l.min === l.max ? `${l.min} jogadores` : `${l.min}–${l.max} jogadores`;
};
