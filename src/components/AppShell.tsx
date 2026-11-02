import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/useMe";
import { levelFromXp } from "@/lib/game";
import { play } from "@/lib/sound";


const NAV = [
  { to: "/home", icon: "🏠", label: "Home" },
  { to: "/examens", icon: "📝", label: "QCM Examens" },
  { to: "/cours", icon: "📚", label: "QCM par Cours" },
  { to: "/mes-erreurs", icon: "🔁", label: "QCM أخطائي السابقة", ar: true },
  { to: "/leaderboard", icon: "🏆", label: "Leaderboard" },
  { to: "/missions", icon: "🎯", label: "Missions" },
  { to: "/profile", icon: "👤", label: "Profile" },
  { to: "/settings", icon: "⚙️", label: "Settings" },
] as const;

async function logout() {
  await supabase.auth.signOut();
  window.location.href = "/auth";
}

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { data: me } = useMe();
  const lv = levelFromXp(me?.xp ?? 0);
  const nav = useNavigate();
  return (
    <div className="min-h-screen pb-24 lg:pb-0 lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-sidebar p-4 lg:flex">
        <Brand />
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} onClick={() => play("nav")}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
              activeProps={{ className: "bg-primary-soft text-primary" }}>
              <span className="text-lg">{n.icon}</span><span className={"ar" in n && n.ar ? "ar" : ""}>{n.label}</span>
            </Link>
          ))}
          {me?.isCreator && (
            <Link to="/admin" className="mt-2 flex items-center gap-3 rounded-xl border border-gold px-3 py-2.5 text-sm font-semibold" activeProps={{ className: "bg-gold/20" }}>
              <span>👑</span>Panneau Creator
            </Link>
          )}
          <button onClick={logout} className="mt-2 flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-medium hover:bg-sidebar-accent">
            <span className="text-lg">🚪</span><span>Se déconnecter</span>
          </button>
        </nav>
        <div className="mt-auto text-xs text-muted-foreground">Université Saad Dahleb – Blida 1<br />Faculté de Médecine</div>
      </aside>

      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className={`mx-auto flex items-center justify-between gap-3 px-4 py-3 ${wide ? "max-w-6xl" : "max-w-4xl"}`}>
          <div className="lg:hidden"><Brand small /></div>
          <div className="hidden text-sm text-muted-foreground lg:block">Bienvenue{me?.display_name ? `, ${me.display_name}` : ""} 👋</div>
          {me && (
            <div className="flex items-center gap-2">
              <button onClick={() => nav({ to: "/profile" })} className="flex items-center gap-3 rounded-full bg-card px-2 py-1 shadow-sm">
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">Nv {me.isCreator ? "∞" : lv.level}</span>
                <span className="text-xs font-semibold">🪙 {me.isCreator ? "∞" : me.coins}</span>
                <span className="text-xs font-semibold">🔥 {me.streak}</span>
                <span aria-hidden="true">👤</span>
              </button>
              <button onClick={logout} aria-label="Se déconnecter" title="Se déconnecter" className="grid h-9 w-9 place-items-center rounded-full bg-card text-lg shadow-sm lg:hidden">🚪</button>
            </div>
          )}
        </div>
      </header>

      <main className={`mx-auto px-4 py-6 ${wide ? "max-w-6xl" : "max-w-4xl"}`}>{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur lg:hidden">
        <div className="flex overflow-x-auto px-1">
          {[...NAV, ...(me?.isCreator ? [{ to: "/admin", icon: "👑", label: "Creator" } as const] : [])].map((n) => (
            <Link key={n.to} to={n.to} onClick={() => play("nav")}
              className="flex min-w-[72px] flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] text-muted-foreground"
              activeProps={{ className: "text-primary font-semibold" }}>
              <span className="text-xl">{n.icon}</span><span className="truncate">{n.label.replace("QCM ", "")}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function Brand({ small = false }: { small?: boolean }) {
  return (
    <Link to="/home" className="flex items-center gap-2">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-hero font-display text-xl font-bold text-primary-foreground shadow-pop">Z</span>
      <span className="leading-tight">
        <span className="block font-display text-lg font-bold">Z QCM GAME</span>
        {!small && <span className="block text-[11px] text-muted-foreground">Blida 1 · Médecine</span>}
      </span>
    </Link>
  );
}

export function PageTitle({ title, ar, sub }: { title: string; ar?: string; sub?: string | undefined }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{title} {ar && <span className="ar text-primary">· {ar}</span>}</h1>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}