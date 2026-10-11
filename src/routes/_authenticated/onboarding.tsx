import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, useRefreshMe } from "@/hooks/useMe";
import { AvatarEditor } from "@/components/AvatarEditor";
import { Brand } from "@/components/AppShell";
import { levelFromXp } from "@/lib/game";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Créer mon personnage — Z QCM GAME" }, { name: "description", content: "Choisis ton nom et crée ton avatar." }] }),
  component: Onboarding,
});

function Onboarding() {
  const { data: me } = useMe();
  const refresh = useRefreshMe();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  if (!me) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Brand />
      {step === 0 ? (
        <div className="card-game mx-auto mt-10 max-w-md p-6 animate-pop">
          <h1 className="font-display text-2xl font-bold">Choisis ton nom</h1>
          <p className="ar text-sm text-muted-foreground">اختر اسمك في اللعبة</p>
          <input value={name || me.display_name || ""} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Ex : Dr Amine"
            className="mt-4 w-full rounded-xl border px-3 py-2.5" />
          <button onClick={() => { const n = (name || me.display_name || "").trim(); if (n.length < 2) return toast.error("2 caractères minimum"); setName(n); setStep(1); }}
            className="mt-4 w-full rounded-xl bg-hero py-2.5 font-semibold text-primary-foreground">Continuer →</button>
        </div>
      ) : (
        <div className="mt-6">
          <h1 className="mb-4 font-display text-2xl font-bold">Crée ton avatar <span className="ar text-primary">· صمّم شخصيتك</span></h1>
          <AvatarEditor initial={me.avatar} pet={me.pet} level={levelFromXp(me.xp).level} unlockAll={me.isCreator} saving={saving}
            onSave={async (avatar, pet) => {
              setSaving(true);
              const { error } = await supabase.from("profiles").update({ display_name: name.trim(), avatar, pet, onboarded: true }).eq("id", me.id);
              setSaving(false);
              if (error) return toast.error(error.message);
              await refresh();
              nav({ to: "/home" });
            }} />
        </div>
      )}
    </div>
  );
}
