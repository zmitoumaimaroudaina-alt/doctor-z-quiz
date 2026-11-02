import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { AvatarEditor } from "@/components/AvatarEditor";
import { useMe, useRefreshMe } from "@/hooks/useMe";
import { levelFromXp } from "@/lib/game";
import type { Database } from "@/integrations/supabase/types";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profil — Z QCM GAME" }, { name: "description", content: "Ton avatar, ton nom et ton compte." }] }),
  component: Profile,
});

function Profile() {
  const { data: me } = useMe();
  const refresh = useRefreshMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const del = useServerFn(deleteMyAccount);
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  if (!me) return <AppShell><p>…</p></AppShell>;

  async function save(patch: Database["public"]["Tables"]["profiles"]["Update"]) {
    if (!me) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(patch).eq("id", me.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Enregistré ✅"); refresh();
  }

  return (
    <AppShell wide>
      <PageTitle title="👤 Profil" ar="الملف الشخصي" sub={me.isCreator ? "👑 Doctor Z — Creator" : undefined} />
      <div className="card-game mb-5 flex flex-wrap items-end gap-3 p-4">
        <label className="flex-1"><span className="text-xs text-muted-foreground">Nom affiché</span>
          <input value={name ?? me.display_name ?? ""} onChange={(e) => setName(e.target.value)} maxLength={24} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
        <button onClick={() => name && name.trim().length >= 2 && save({ display_name: name.trim() })} className="rounded-xl bg-primary px-4 py-2 text-primary-foreground">Enregistrer</button>
      </div>
      <AvatarEditor initial={me.avatar} pet={me.pet} level={levelFromXp(me.xp).level} unlockAll={me.isCreator} saving={saving} onSave={(avatar, pet) => save({ avatar, pet })} />

      {!me.isCreator && (
        <div className="card-game mt-8 border-destructive/40 p-5">
          <h2 className="font-display text-lg font-bold text-destructive">Supprimer mon compte</h2>
          <p className="mt-1 text-sm text-muted-foreground">Action définitive : ton compte, ton avatar, tes scores et ton rang disparaissent complètement du jeu.</p>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Tape SUPPRIMER" className="mt-3 w-full rounded-xl border px-3 py-2 text-sm" />
          <button disabled={confirmText !== "SUPPRIMER"} onClick={async () => {
            try { await del(); await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); nav({ to: "/", replace: true }); toast.success("Compte supprimé."); }
            catch (e) { toast.error((e as Error).message); }
          }} className="mt-3 rounded-xl bg-destructive px-4 py-2 font-semibold text-destructive-foreground disabled:opacity-40">Supprimer définitivement</button>
        </div>
      )}
    </AppShell>
  );
}
