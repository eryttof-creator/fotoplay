import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, LogIn, Users, Sparkles, Shield, Camera, RefreshCw, Tv, Bot } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TopBar, useOnlineCount } from "@/components/Chrome";
import { ProfileEditor } from "@/components/ProfileEditor";
import { GAMES, playersLabel } from "@/lib/games/catalog";
import { useMyProfile } from "@/lib/profile";
import { createRoom, joinRoom } from "@/lib/api/rooms.functions";
import hero from "@/assets/hero-collage.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FOTO PLAY — Minijogos multiplayer com as suas fotos" },
      { name: "description", content: "Crie uma sala, mande o código para os amigos e jogue Jogo da Velha, Memória e mais usando as fotos de vocês." },
      { property: "og:title", content: "FOTO PLAY — Seus amigos, suas fotos, seus jogos!" },
      { property: "og:description", content: "Crie uma sala privada e jogue com seus amigos em tempo real, com as fotos de vocês como peças." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const NEWS = [
  { icon: Tv, title: "Modo Televisão", text: "Use sua TV como segunda tela no Quiz da Galera e responda pelo celular!" },
  { icon: Bot, title: "Mais robôs no modo solo", text: "Agora as partidas solo começam com 3 robôs, respeitando o limite de cada jogo." },
  { icon: Users, title: "Sistema de Amizades", text: "Crie seu @usuário exclusivo, adicione amigos e convide direto pras salas." },
  { icon: Camera, title: "Fotos protegidas", text: "Só quem está na mesma sala consegue ver a sua foto de jogador." },
];

function Home() {
  const online = useOnlineCount();
  const { profile, save } = useMyProfile();
  const [mode, setMode] = useState<"create" | "join" | "solo" | null>(null);
  const [code, setCode] = useState("");
  const [lastRoom, setLastRoom] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => setLastRoom(localStorage.getItem("fp-last-room")), []);

  return (
    <div className="min-h-screen bg-hero">
      <TopBar />
      <main className="mx-auto max-w-6xl px-4 pb-20">
        <section className="grid items-center gap-10 py-8 md:grid-cols-2 md:py-14">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-card px-3 py-1 text-sm font-medium shadow-pop-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>
              {online === null ? "Conectando…" : `${online} ${online === 1 ? "pessoa online" : "pessoas online"} agora`}
            </div>
            <h1 className="text-5xl font-extrabold leading-[0.95] md:text-7xl">
              Seus amigos,
              <br />
              <span className="text-primary">suas fotos,</span>
              <br />
              seus jogos!
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Crie uma sala, mande o código e jogue em tempo real — com a cara de cada um no lugar das peças.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button variant="pop" size="xl" onClick={() => setMode("create")}>
                <Plus /> CRIAR SALA
              </Button>
              <Button variant="popLime" size="xl" onClick={() => setMode("join")}>
                <LogIn /> ENTRAR EM SALA
              </Button>
              <Button variant="popPlain" size="xl" onClick={() => setMode("solo")}>
                <Bot /> JOGAR SOZINHO
              </Button>
              <Button variant="popPlain" size="xl" onClick={() => navigate({ to: "/tv" })} className="bg-sun">
                <Tv /> MODO TV
              </Button>
            </div>
            {lastRoom && (
              <Link to="/sala/$code" params={{ code: lastRoom }} className="mt-4 inline-block text-sm font-medium underline underline-offset-4">
                Voltar para a sala {lastRoom}
              </Link>
            )}
          </div>
          <div className="relative">
            <img src={hero} alt="Colagem de fotos de amigos e peças de jogos" width={1280} height={960} className="animate-float rounded-3xl border-2 border-ink shadow-pop" />
          </div>
        </section>

        <section className="py-10">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-3xl font-extrabold md:text-4xl">Jogos disponíveis</h2>
            <span className="text-sm text-muted-foreground">{GAMES.length} minijogos</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GAMES.map((g, i) => (
              <button
                key={g.id}
                onClick={() => setMode("create")}
                className="press group rounded-3xl border-2 border-ink bg-card p-5 text-left shadow-pop transition-transform hover:-translate-y-1"
                style={{ rotate: `${(i % 3) - 1}deg` }}
              >
                <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-ink text-3xl ${g.color}`}>{g.emoji}</div>
                <h3 className="text-xl font-bold">{g.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{g.tagline}</p>
                <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                  <Users className="h-3.5 w-3.5" /> {playersLabel(g.id)}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="py-10">
          <h2 className="mb-6 flex items-center gap-2 text-3xl font-extrabold md:text-4xl">
            <Sparkles className="h-7 w-7 text-primary" /> Novidades
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {NEWS.map((n) => (
              <div key={n.title} className="rounded-3xl border-2 border-ink bg-card p-5 shadow-pop-sm">
                <n.icon className="mb-3 h-6 w-6 text-primary" />
                <h3 className="font-bold">{n.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{n.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Dialog open={!!mode} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-2 border-ink">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{mode === "create" ? "Criar sala" : mode === "solo" ? "Jogar contra robôs" : "Entrar em uma sala"}</DialogTitle>
            <DialogDescription>
              {mode === "solo"
                ? "Você entra numa sala com três robôs. Ao escolher um jogo com limite menor, os robôs se ajustam automaticamente."
                : "Escolha seu apelido e sua foto — ela vai virar sua peça nos jogos."}
            </DialogDescription>
          </DialogHeader>
          {profile && mode && (
            <ProfileEditor
              key={mode}
              initial={{ nickname: profile.nickname, avatar: profile.avatar, photo_path: profile.photo_path }}
              submitLabel={mode === "create" ? "Criar sala" : mode === "solo" ? "Jogar agora" : "Entrar"}
              extra={
                mode === "join" && (
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Código da sala</span>
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                      placeholder="ABC234"
                      className="h-14 rounded-xl border-2 text-center font-display text-2xl tracking-[0.4em] uppercase"
                    />
                  </label>
                )
              }
              onSubmit={async (p) => {
                if (mode === "join" && code.length !== 6) throw new Error("O código da sala tem 6 caracteres.");
                await save(p);
                const res =
                  mode !== "join"
                    ? await createRoom({ data: { ...p, bots: mode === "solo" ? 3 : 0 } })
                    : await joinRoom({ data: { ...p, code } });
                navigate({ to: "/sala/$code", params: { code: res.code } });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
