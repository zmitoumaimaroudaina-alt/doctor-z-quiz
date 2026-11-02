import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { useMe, useRefreshMe } from "@/hooks/useMe";
import { levelFromXp, PETS, rpcError } from "@/lib/game";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/missions")({
  head: () => ({ meta: [{ title: "Missions — Z QCM GAME" }, { name: "description", content: "Missions quotidiennes et hebdomadaires, XP et récompenses." }] }),
  component: Missions,
});

function dz() { return new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Algiers" })); }

function Missions() {
  const { data: me } = useMe();
  const refresh = useRefreshMe();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["missions"],
    queryFn: async () => {
      const d = dz(); const today = d.toISOString().slice(0, 10);
      const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7)); monday.setHours(0, 0, 0, 0);
      const [{ count: examsToday }, { count: examsWeek }, { count: fixedToday }, { data: claims }] = await Promise.all([
        supabase.from("attempts").select("id", { count: "exact", head: true }).not("submitted_at", "is", null).gte("submitted_at", today),
        supabase.from("attempts").select("id", { count: "exact", head: true }).not("submitted_at", "is", null).gte("submitted_at", monday.toISOString()),
        supabase.from("question_mistakes").select("question_id", { count: "exact", head: true }).gte("corrected_at", today),
        supabase.from("mission_claims").select("mission_key, period_key, claimed_at").gte("claimed_at", monday.toISOString()),
      ]);
      return { examsToday: examsToday ?? 0, examsWeek: examsWeek ?? 0, fixedToday: fixedToday ?? 0, claims: claims ?? [], today };
    },
  });
  if (!me || !data) return <AppShell><p>…</p></AppShell>;
  const claimed = (k: string, daily: boolean) => data.claims.some((c) => c.mission_key === k && (!daily || c.period_key === data.today));
  const M = [
    { key: "daily_exam", daily: true, title: "Termine 1 examen aujourd'hui", p: data.examsToday, goal: 1, xp: 30, coins: 10 },
    { key: "daily_review", daily: true, title: "Corrige 3 anciennes erreurs", p: data.fixedToday, goal: 3, xp: 40, coins: 15 },
    { key: "weekly_exams", daily: false, title: "Termine 5 examens cette semaine", p: data.examsWeek, goal: 5, xp: 150, coins: 60 },
    { key: "weekly_streak", daily: false, title: "Atteins une série de 5 jours", p: me.streak, goal: 5, xp: 120, coins: 50 },
  ];
  const lv = levelFromXp(me.xp);

  async function claim(key: string) {
    const { error } = await supabase.rpc("claim_mission", { _key: key });
    if (error) { toast.error(rpcError(error)); return; }
    play("reward");
    const before = lv.level;
    await refresh(); qc.invalidateQueries({ queryKey: ["missions"] });
    const after = levelFromXp((await supabase.from("profiles").select("xp").eq("id", me!.id).single()).data?.xp ?? 0).level;
    if (after > before) { play("levelUp"); toast.success(`⬆️ Niveau ${after} !`); } else toast.success("Récompense obtenue 🎁");
  }

  return (
    <AppShell>
      <PageTitle title="🎯 Missions" ar="المهام" sub="XP, niveaux et pièces sont séparés du score académique et du classement." />
      <div className="card-game mb-5 flex items-center gap-4 p-4">
        <div className="font-display text-3xl font-bold text-primary">Nv {me.isCreator ? "∞" : lv.level}</div>
        <div className="flex-1"><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full bg-hero" style={{ width: `${me.isCreator ? 100 : lv.progress * 100}%` }} /></div>
          <div className="mt-1 text-xs text-muted-foreground">{me.xp} XP · 🪙 {me.isCreator ? "∞" : me.coins} · 🔥 {me.streak} jour(s)</div></div>
      </div>
      <div className="space-y-3">
        {M.map((m) => {
          const done = me.isCreator || m.p >= m.goal; const c = claimed(m.key, m.daily);
          return (
            <div key={m.key} className="card-game flex items-center gap-3 p-4">
              <span className="text-2xl">{m.daily ? "☀️" : "📅"}</span>
              <div className="flex-1">
                <div className="font-semibold">{m.title}</div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-success" style={{ width: `${Math.min(100, (m.p / m.goal) * 100)}%` }} /></div>
                <div className="mt-1 text-xs text-muted-foreground">{Math.min(m.p, m.goal)}/{m.goal} · +{m.xp} XP · +{m.coins} 🪙</div>
              </div>
              <button disabled={!done || c} onClick={() => claim(m.key)} className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">{c ? "✓" : "Réclamer"}</button>
            </div>
          );
        })}
      </div>
      <h2 className="mt-8 font-display text-lg font-bold">Animaux à débloquer</h2>
      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {PETS.map((p) => <div key={p.id} className={`card-game p-3 text-center ${!me.isCreator && lv.level < p.level ? "opacity-40" : ""}`}><div className="text-3xl">{p.emoji}</div><div className="text-xs">Nv {p.level}</div></div>)}
      </div>
    </AppShell>
  );
}
