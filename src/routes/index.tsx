import { pageMetadata } from "@/lib/metadata";
import { createFileRoute, Link } from "@tanstack/react-router";
import opening from "@/assets/medical-chess.png.asset.json";
import { Brand } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => pageMetadata("QCM médicaux Blida 1", "Questions de la Faculté de Médecine de l’Université de Blida, examens et entraînement par cours."),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Brand />
        <Link to="/auth" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-pop">Se connecter</Link>
      </header>
      <section className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-8 md:grid-cols-2 md:py-16">
        <div>
          <p className="text-sm font-semibold text-primary">Université Saad Dahleb – Blida 1 · Faculté de Médecine</p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">Z QCM GAME</h1>
          <p className="ar mt-3 text-lg text-muted-foreground">راجع، العب، وتقدّم مع زملائك</p>
          <p className="mt-4 text-muted-foreground">Vrais examens chronométrés, QCM par cours, corrections officielles, explications IA, classement en direct et tomates 🍅 pour le Top 5.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/auth" className="rounded-2xl bg-hero px-6 py-3 font-semibold text-primary-foreground shadow-pop">Commencer · ابدأ</Link>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-3 text-center text-sm">
            {[["📝", "QCM Examens"], ["📚", "QCM par Cours"], ["🏆", "Leaderboard"]].map(([i, l]) => (
              <div key={l} className="card-game p-3"><div className="text-2xl">{i}</div><div className="mt-1 font-medium">{l}</div></div>
            ))}
          </div>
        </div>
        <img src={opening.url} alt="Étudiante en médecine jouant aux échecs contre la mort" className="w-full rounded-3xl shadow-pop" />
      </section>
    </div>
  );
}

