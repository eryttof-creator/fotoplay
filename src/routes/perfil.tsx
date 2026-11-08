import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Trophy, Gamepad2, Frown, Star } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/Chrome";
import { ProfileEditor } from "@/components/ProfileEditor";
import { useMyProfile } from "@/lib/profile";
import { gameInfo } from "@/lib/games/catalog";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — FOTO PLAY" },
      { name: "description", content: "Sua foto, apelido, vitórias, derrotas e jogos favoritos no FOTO PLAY." },
      { property: "og:title", content: "Meu perfil — FOTO PLAY" },
      { property: "og:description", content: "Veja suas estatísticas de partidas no FOTO PLAY." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, loading, save } = useMyProfile();
  const favorites = Object.entries(profile?.game_counts ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return (
    <div className="min-h-screen bg-hero">
      <TopBar />
      <main className="mx-auto grid max-w-4xl gap-6 px-4 pb-16 md:grid-cols-2">
        {loading || !profile ? (
          <Loader2 className="mx-auto animate-spin" />
        ) : (
          <>
            <section className="rounded-3xl border-2 border-ink bg-card p-6 shadow-pop">
              <h1 className="mb-5 text-3xl font-extrabold">Meu perfil</h1>
              <ProfileEditor
                initial={{ nickname: profile.nickname, avatar: profile.avatar, photo_path: profile.photo_path }}
                submitLabel="Salvar perfil"
                onSubmit={async (p) => {
                  await save(p);
                  toast.success("Perfil salvo!");
                }}
              />
            </section>
            <section className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Gamepad2, label: "Partidas", value: profile.matches, cls: "bg-sky" },
                  { icon: Trophy, label: "Vitórias", value: profile.wins, cls: "bg-accent" },
                  { icon: Frown, label: "Derrotas", value: profile.losses, cls: "bg-primary text-primary-foreground" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-3xl border-2 border-ink p-4 shadow-pop-sm ${s.cls}`}>
                    <s.icon className="mb-2 h-5 w-5" />
                    <p className="font-display text-3xl font-extrabold">{s.value}</p>
                    <p className="text-xs font-medium">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-3xl border-2 border-ink bg-card p-5 shadow-pop-sm">
                <h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><Star className="h-5 w-5 text-primary" /> Jogos favoritos</h2>
                {favorites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Jogue algumas partidas para ver seus favoritos aqui.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {favorites.map(([id, n]) => (
                      <li key={id} className="flex items-center gap-3 rounded-2xl bg-muted p-3">
                        <span className="text-2xl">{gameInfo(id).emoji}</span>
                        <span className="flex-1 font-bold">{gameInfo(id).name}</span>
                        <span className="text-sm text-muted-foreground">{n} partida(s)</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
