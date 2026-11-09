import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Tv, Smartphone, Sparkles, QrCode, Play, Users } from "lucide-react";
import { TopBar } from "@/components/Chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProfileEditor } from "@/components/ProfileEditor";
import { useMyProfile } from "@/lib/profile";
import { createTvSession, joinTvSession } from "@/lib/api/tv.functions";
import { pageHead } from "@/lib/metadata";
import { toast } from "sonner";

export const Route = createFileRoute("/tv")({
  head: () =>
    pageHead(
      "Modo Televisão — FOTO PLAY",
      "Use sua TV como tela principal para acompanhar os jogos e responda direto pelo celular."
    ),
  component: TvHubPage,
});

function TvHubPage() {
  const { profile, save } = useMyProfile();
  const navigate = useNavigate();
  const [modalMode, setModalMode] = useState<"host_tv" | "join_controller" | null>(null);
  const [tvCode, setTvCode] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="min-h-screen bg-hero">
      <TopBar />
      <main className="mx-auto max-w-5xl px-4 py-8 pb-20">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-sun px-4 py-1.5 text-sm font-extrabold shadow-pop-sm">
            <Tv className="h-4 w-4" /> NOVIDADE FOTO PLAY
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Modo <span className="text-primary">Televisão</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Transforme a sua TV na tela principal do jogo e use os celulares de cada amigo como controle interativo!
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Card 1: Abrir na TV */}
          <div className="flex flex-col justify-between rounded-3xl border-2 border-ink bg-card p-6 shadow-pop transition-transform hover:-translate-y-1">
            <div>
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-ink bg-coral text-3xl shadow-pop-sm">
                📺
              </div>
              <h2 className="text-2xl font-extrabold">Abrir na Televisão</h2>
              <p className="mt-2 text-muted-foreground">
                Abra esta tela na sua Smart TV, videogame ou computador conectado à TV. Ela exibirá o painel principal,
                o cronômetro, as perguntas e o placar.
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold">✓</span>
                  Gera QR Code e código grande para a sala
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold">✓</span>
                  Exibe perguntas e alternativas em tela cheia
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold">✓</span>
                  As respostas individuais não vazam na TV antes da hora
                </li>
              </ul>
            </div>
            <Button
              variant="pop"
              size="xl"
              className="mt-6 w-full"
              onClick={() => setModalMode("host_tv")}
            >
              <Play className="h-5 w-5" /> CRIAR SESSÃO NA TV
            </Button>
          </div>

          {/* Card 2: Conectar Celular */}
          <div className="flex flex-col justify-between rounded-3xl border-2 border-ink bg-card p-6 shadow-pop transition-transform hover:-translate-y-1">
            <div>
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-ink bg-lime text-3xl shadow-pop-sm">
                📱
              </div>
              <h2 className="text-2xl font-extrabold">Entrar como Controle</h2>
              <p className="mt-2 text-muted-foreground">
                Está vendo o código ou QR Code na TV? Conecte seu celular para utilizá-lo como controle das rodadas.
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold">✓</span>
                  Responda com toques rápidos no seu próprio celular
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold">✓</span>
                  Sincronização em tempo real com o telão
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-bold">✓</span>
                  Multiplayer com quantos amigos quiser na sala
                </li>
              </ul>
            </div>
            <Button
              variant="popLime"
              size="xl"
              className="mt-6 w-full"
              onClick={() => setModalMode("join_controller")}
            >
              <Smartphone className="h-5 w-5" /> CONECTAR MEU CELULAR
            </Button>
          </div>
        </div>

        {/* Como Funciona */}
        <section className="mt-12 rounded-3xl border-2 border-ink bg-card p-6 shadow-pop-sm">
          <h3 className="mb-4 flex items-center gap-2 text-xl font-extrabold">
            <Sparkles className="h-5 w-5 text-primary" /> Como funciona o Modo TV?
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-muted p-4">
              <span className="mb-2 block font-display text-2xl font-extrabold text-primary">1. Crie a sessão</span>
              <p className="text-sm text-muted-foreground">
                Abra no navegador da TV ou transmita para a tela. A TV gera um QR Code e um código de 6 letras.
              </p>
            </div>
            <div className="rounded-2xl bg-muted p-4">
              <span className="mb-2 block font-display text-2xl font-extrabold text-primary">2. Escaneie</span>
              <p className="text-sm text-muted-foreground">
                Cada amigo aponta a câmera do celular para o QR Code da TV ou digita o código na página.
              </p>
            </div>
            <div className="rounded-2xl bg-muted p-4">
              <span className="mb-2 block font-display text-2xl font-extrabold text-primary">3. Joguem juntos</span>
              <p className="text-sm text-muted-foreground">
                A pergunta aparece na TV; cada um toca na sua resposta no celular. A TV vibra com a revelação!
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Dialog for Host TV or Join Controller */}
      <Dialog open={!!modalMode} onOpenChange={(open) => !open && setModalMode(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-2 border-ink">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {modalMode === "host_tv" ? "Criar Sessão na TV" : "Entrar como Controle"}
            </DialogTitle>
            <DialogDescription>
              {modalMode === "host_tv"
                ? "Escolha seu apelido para ser o anfitrião da TV."
                : "Digite o código exibido na TV e escolha seu perfil de jogador."}
            </DialogDescription>
          </DialogHeader>

          {profile && modalMode && (
            <ProfileEditor
              key={modalMode}
              initial={{ nickname: profile.nickname, avatar: profile.avatar, photo_path: profile.photo_path }}
              submitLabel={modalMode === "host_tv" ? "Iniciar Sessão na TV" : "Conectar Controle"}
              extra={
                modalMode === "join_controller" ? (
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold">Código exibido na TV</span>
                    <Input
                      value={tvCode}
                      onChange={(e) =>
                        setTvCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
                      }
                      placeholder="Ex: ABC234"
                      className="h-14 rounded-xl border-2 text-center font-display text-3xl tracking-[0.4em] uppercase"
                      required
                    />
                  </label>
                ) : undefined
              }
              onSubmit={async (p) => {
                setBusy(true);
                try {
                  await save(p);
                  if (modalMode === "host_tv") {
                    const res = await createTvSession({
                      data: { nickname: p.nickname, avatar: p.avatar, photo_path: p.photo_path },
                    });
                    toast.success("Sessão criada! Abrindo painel da TV...");
                    await navigate({ to: "/tv/$code", params: { code: res.code } });
                  } else {
                    if (tvCode.length !== 6) throw new Error("O código da TV tem 6 caracteres.");
                    const res = await joinTvSession({
                      data: { code: tvCode, nickname: p.nickname, avatar: p.avatar, photo_path: p.photo_path },
                    });
                    toast.success("Conectado à TV com sucesso!");
                    await navigate({ to: "/tv/controle/$code", params: { code: res.code } });
                  }
                } catch (e: any) {
                  toast.error(e?.message || "Não foi possível conectar.");
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
