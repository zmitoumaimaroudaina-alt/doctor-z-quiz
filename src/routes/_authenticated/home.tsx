import { pageMetadata } from "@/lib/metadata";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { useMe } from "@/hooks/useMe";
import { levelFromXp, RESOURCES } from "@/lib/game";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => pageMetadata("Accueil", "Ton espace QCM de médecine à Blida."),
  component: Home,
});

function Home() {
  const { data: me, isLoading } = useMe();
  if (isLoading) return <div className="p-8 text-center">Chargement…</div>;
  if (!me) return <Navigate to="/auth" />;
  if (!me.onboarded) return <Navigate to="/onboarding" />;
  const lv = levelFromXp(me.xp);
  return (
    <AppShell>
      <section className="relative overflow-hidden rounded-3xl bg-hero p-6 text-primary-foreground shadow-pop">
        <div className="flex items-center gap-4">
          <Avatar config={me.avatar} mood="happy" size={110} pet={me.pet} />
          <div>
            <p className="text-sm opacity-90">Université Saad Dahleb – Blida 1 · Faculté de Médecine</p>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Salut {me.display_name} 👋</h1>
            <p className="ar opacity-90">مرحبا! واش راك حاب تراجع اليوم؟</p>
            <div className="mt-3 h-2 w-48 overflow-hidden rounded-full bg-primary-foreground/30">
              <div className="h-full rounded-full bg-gold" style={{ width: `${me.isCreator ? 100 : Math.round(lv.progress * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs opacity-90">Niveau {me.isCreator ? "∞" : lv.level} · {me.xp} XP {me.isCreator && "· 👑 Creator"}</p>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Tile to="/examens" icon="📝" title="QCM Examens" sub="Matière → Année → Examen · 60 min" />
        <Tile to="/cours" icon="📚" title="QCM par Cours" sub="Matière → Cours → QCM" />
        <Tile to="/mes-cours" icon="📄" title="Mes cours PDF" sub="Générer des QCM IA depuis tes cours" />
        <Tile to="/mes-erreurs" icon="🔁" title="QCM أخطائي السابقة" sub="Rejoue tes anciennes erreurs" />
        <Tile to="/leaderboard" icon="🏆" title="Leaderboard" sub="Top 5 + tomates 🍅" />
        <Tile to="/missions" icon="🎯" title="Missions" sub="Quotidiennes & hebdomadaires" />
        <Tile to="/profile" icon="👤" title="Mon profil" sub="Avatar, animal, styles & bulle" />
        <Tile to="/settings" icon="⚙️" title="Paramètres & Sons" sub="Volume, test des effets sonores & ressources" />
      </div>

      <Link to="/questions-a-verifier" className="mt-6 block text-sm font-semibold text-warning-foreground">⚠ Questions à vérifier · أسئلة تحتاج مراجعة</Link>

      <section dir="rtl" className="card-game mt-8 p-4">
        <h2 className="font-display text-base font-bold">📢 تابعوا Doctor Z و Med Support</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {RESOURCES.map((c) => (
            <a
              key={c.href}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
            >{c.icon} {c.label}</a>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function Tile({ to, icon, title, sub }: { to: "/examens" | "/cours" | "/mes-cours" | "/mes-erreurs" | "/leaderboard" | "/missions" | "/profile" | "/settings"; icon: string; title: string; sub: string }) {
  return <Link to={to} className="card-game flex items-center gap-3 p-4 hover:shadow-pop transition-shadow"><span className="text-3xl">{icon}</span><div><h2 className="font-display font-bold">{title}</h2><p className="text-sm text-muted-foreground">{sub}</p></div></Link>;
}