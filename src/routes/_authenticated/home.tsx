import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/useMe";
import { levelFromXp } from "@/lib/game";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Accueil — Z QCM GAME" }, { name: "description", content: "Ton tableau de bord Z QCM GAME." }] }),
  component: Home,
});

const CHANNELS = [
  { icon: "▶️", label: "Doctor Z — YouTube", href: "https://youtube.com/@doctorz-i2007?si=WhkCMFBIccxYDO9l" },
  { icon: "▶️", label: "Med Support — YouTube", href: "https://youtube.com/@medisuppor1?si=YL2jAcqpSdClp0ep" },
  { icon: "✈️", label: "Med Support — Telegram", href: "https://t.me/+ubEdEFjoMtllYzE8" },
];

function Home() {
  const { data: me, isLoading } = useMe();
  if (isLoading) return null;
  if (me && !me.onboarded) return <Navigate to="/onboarding" />;
  if (!me) return null;
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
            <div className="mt-3 h-2 w-48 overflow-hidden