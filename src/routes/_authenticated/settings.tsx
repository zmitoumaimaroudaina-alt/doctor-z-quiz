import { pageMetadata } from "@/lib/metadata";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { useMe } from "@/hooks/useMe";
import { RESOURCES } from "@/lib/game";
import { getSoundVolume, isSoundOn, play, setSoundOn, setSoundVolume, SOUND_EFFECTS_LIST } from "@/lib/sound";
import { clearCurrentSession, saveProfileDurable } from "@/lib/profileStore";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => pageMetadata("Paramètres", "Sons et ressources éducatives Z QCM GAME."),
  component: Settings,
});

function Settings() {
  const { data: me } = useMe();
  const [sound, setSound] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const nav = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    setSound(isSoundOn());
    setVolume(getSoundVolume());
  }, [me]);

  async function toggle() {
    const v = !sound;
    setSound(v);
    setSoundOn(v);
    if (v) play("click");
    if (me) {
      saveProfileDurable(me.email, { sound_on: v });
      void supabase.from("profiles").update({ sound_on: v }).eq("id", me.id);
    }
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setSoundVolume(val);
  }

  async function signOut() {
    clearCurrentSession();
    await qc.cancelQueries();
    qc.clear();
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore offline
    }
    toast.success("Déconnexion réussie");
    nav({ to: "/auth", replace: true });
  }

  return (
    <AppShell>
      <PageTitle title="⚙️ Paramètres" ar="الإعدادات والأصوات" sub="Personnalisation des effets sonores et ressources de la faculté." />

      <div className="card-game space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-base">🔊 Effets sonores · المؤثرات الصوتية</div>
            <div className="text-xs text-muted-foreground">تفعيل أو كتم جميع أصوات اللعبة (إجابات، ترقيات، طماطم).</div>
          </div>
          <button
            onClick={toggle}
            className={`rounded-full px-5 py-2 text-sm font-bold shadow-sm transition-all ${
              sound ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {sound ? "ACTIVÉ · شغال" : "MUET · صامت"}
          </button>
        </div>

        {sound && (
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-1.5">
              <span>🎚️ Volume sonore (مستوى الصوت)</span>
              <span>{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              className="w-full accent-primary"
            />
          </div>
        )}
      </div>

      <div className="card-game mt-6 p-5">
        <h2 className="font-display text-base font-bold mb-3 flex items-center gap-2">
          <span>🎵</span>
          <span>Tester les effets sonores · تجربة الأصوات</span>
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          اضغط على أي مؤثر لتجربة صوته والتأكد من عمله في متصفحك:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {SOUND_EFFECTS_LIST.map((s) => (
            <button
              key={s.key}
              onClick={() => play(s.key)}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 text-left text-xs font-medium hover:bg-muted/60 transition-colors active:scale-95"
            >
              <span className="text-xl">{s.icon}</span>
              <div className="truncate">
                <span className="block font-semibold truncate">{s.label}</span>
                <span className="ar text-[11px] text-muted-foreground">{s.ar}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <h2 className="mt-8 font-display text-lg font-bold">Ressources éducatives · موارد الكلية</h2>
      <div className="mt-3 space-y-2">
        {RESOURCES.map((r) => (
          <a
            key={r.href}
            href={r.href}
            target="_blank"
            rel="noreferrer"
            className="card-game flex items-center gap-3 p-4 hover:shadow-pop transition-shadow"
          >
            <span className="text-xl">{r.icon}</span>
            <span className="font-medium text-sm">{r.label}</span>
          </a>
        ))}
      </div>

      <button
        onClick={signOut}
        className="mt-8 w-full rounded-2xl border border-destructive/40 bg-destructive/5 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
      >
        🚪 Se déconnecter (تسجيل الخروج)
      </button>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Université Saad Dahleb – Blida 1 · Faculté de Médecine
      </p>
    </AppShell>
  );
}
