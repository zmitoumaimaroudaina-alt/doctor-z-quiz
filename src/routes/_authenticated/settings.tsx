import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { useMe } from "@/hooks/useMe";
import { RESOURCES } from "@/lib/game";
import { isSoundOn, play, setSoundOn } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Paramètres — Z QCM GAME" }, { name: "description", content: "Son, ressources et déconnexion." }] }),
  component: Settings,
});

function Settings() {
  const { data: me } = useMe();
  const [sound, setSound] = useState(true);
  const nav = useNavigate();
  const qc = useQueryClient();
  useEffect(() => { setSound(me ? me.sound_on && isSoundOn() : isSoundOn()); }, [me]);

  async function toggle() {
    const v = !sound; setSound(v); setSoundOn(v); if (v) play("click");
    if (me) await supabase.from("profiles").update({ sound_on: v }).eq("id", me.id);
  }
  async function signOut() {
    await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); nav({ to: "/auth", replace: true });
  }
  return (
    <AppShell>
      <PageTitle title="⚙️ Paramètres" ar="الإعدادات" />
      <div className="card-game flex items-center justify-between p-4">
        <div><div className="font-semibold">🔊 Effets sonores</div><div className="text-xs text-muted-foreground">Aucune musique, uniquement des effets.</div></div>
        <button onClick={toggle} className={`rounded-full px-4 py-2 text-sm font-semibold ${sound ? "bg-success text-success-foreground" : "bg-muted"}`}>{sound ? "ON" : "OFF"}</button>
      </div>
      <h2 className="mt-6 font-display text-lg font-bold">Ressources éducatives</h2>
      <div className="mt-3 space-y-2">
        {RESOURCES.map((r) => <a key={r.href} href={r.href} target="_blank" rel="noreferrer" className="card-game flex items-center gap-3 p-4"><span>{r.icon}</span>{r.label}</a>)}
      </div>
      <button onClick={signOut} className="mt-8 w-full rounded-xl border py-3 font-semibold">Se déconnecter</button>
      <p className="mt-6 text-center text-xs text-muted-foreground">Université Saad Dahleb – Blida 1 · Faculté de Médecine</p>
    </AppShell>
  );
}
