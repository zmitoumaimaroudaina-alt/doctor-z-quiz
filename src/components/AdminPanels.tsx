import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, type AvatarConfig, OPTIONS, OUTFITS } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { auditNextBatch } from "@/lib/audit.functions";
import { deleteStudent } from "@/lib/account.functions";
import { useAvatarSettings, type AvatarDisabled } from "@/hooks/useAvatarSettings";

export function Corrections() {
  const qc = useQueryClient();
  const audit = useServerFn(auditNextBatch);
  const [running, setRunning] = useState(false);
  const { data } = useQuery({
    queryKey: ["corrections"],
    queryFn: async () => (await supabase.from("question_corrections")
      .select("*, questions(stem, case_text, options, question_keys(correct))").eq("status", "pending").order("created_at")).data ?? [],
  });
  async function runAll() {
    if (!import.meta.env["VITE_SUPABASE_URL"]) {
      toast.error("L'audit IA nécessite la configuration serveur Supabase + clé IA.");
      return;
    }
    setRunning(true);
    try {
      for (let i = 0; i < 60; i++) {
        const r = await audit();
        qc.invalidateQueries({ queryKey: ["corrections"] });
        if (!r.processed) { toast.success("Analyse terminée"); break; }
        toast.message(`Analysées : ${r.processed} · restantes ≈ ${r.remaining}`);
      }
    } catch (e) { toast.error((e as Error).message); }
    setRunning(false);
  }
  async function decide(id: string, accept: boolean) {
    const { error } = await supabase.rpc("apply_question_correction", { _id: id, _accept: accept });
    if (error) return toast.error(error.message);
    toast.success(accept ? "Correction appliquée (original conservé)" : "Proposition rejetée");
    qc.invalidateQueries({ queryKey: ["corrections"] });
    return undefined;
  }
  return <div className="space-y-3">
    <div className="card-game flex flex-wrap items-center gap-3 p-4">
      <p className="flex-1 text-sm">L'IA relit les questions signalées et les cas cliniques (OCR, doublons, cas mal attribués, réponses douteuses). Rien n'est modifié sans votre validation.</p>
      <Button disabled={running} onClick={() => void runAll()}>{running ? "Analyse…" : "🔬 Lancer l'analyse"}</Button>
    </div>
    {data?.map((c) => {
      const q = c.questions as unknown as { stem: string; case_text: string | null; options: { key: string; text: string }[]; question_keys: { correct: string[] } | { correct: string[] }[] | null } | null;
      const key = Array.isArray(q?.question_keys) ? q?.question_keys[0] : q?.question_keys;
      return <div key={c.id} className="card-game space-y-2 p-4 text-sm">
        <div className="font-semibold">⚠ {c.issue} <span className="text-xs text-muted-foreground">· confiance {c.confidence}</span></div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-2"><div className="text-xs font-bold text-muted-foreground">Actuel</div>
            {q?.case_text && <p className="whitespace-pre-wrap text-xs">{q.case_text}</p>}
            <p className="font-medium">{q?.stem}</p>
            {q?.options.map((o) => <div key={o.key}>{o.key}. {o.text}</div>)}
            <div className="mt-1">Réponse : <b>{key?.correct?.join("") || "—"}</b></div></div>
          <div className="rounded-lg border border-primary p-2"><div className="text-xs font-bold text-primary">Proposition</div>
            {c.proposed_case_text !== null && <p className="whitespace-pre-wrap text-xs">{c.proposed_case_text || "(cas clinique retiré)"}</p>}
            {c.proposed_stem && <p className="font-medium">{c.proposed_stem}</p>}
            {(c.proposed_options as { key: string; text: string }[] | null)?.map((o) => <div key={o.key}>{o.key}. {o.text}</div>)}
            {c.proposed_correct?.length ? <div className="mt-1">Réponse : <b>{c.proposed_correct.join("")}</b></div> : null}</div>
        </div>
        <p className="text-muted-foreground">{c.justification}</p>
        <div className="flex gap-2"><Button onClick={() => void decide(c.id, true)}>✅ Appliquer</Button><Button variant="outline" onClick={() => void decide(c.id, false)}>Rejeter</Button></div>
      </div>;
    })}
    {data && !data.length && <p className="text-muted-foreground">Aucune proposition en attente.</p>}
  </div>;
}

export function StudentsPanel() {
  const qc = useQueryClient();
  const del = useServerFn(deleteStudent);
  const [sort, setSort] = useState<"avg" | "exams" | "xp">("avg");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ["admin-students"], queryFn: async () => (await supabase.rpc("admin_student_stats")).data ?? [] });
  const rows = [...(data ?? [])].sort((a, b) => sort === "avg" ? Number(b.avg_score ?? -1) - Number(a.avg_score ?? -1) : sort === "exams" ? Number(b.exams_done) - Number(a.exams_done) : b.xp - a.xp);
  async function resetHearts(id: string) {
    const { error } = await supabase.from("exam_hearts").delete().eq("user_id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cœurs restaurés ❤️❤️");
  }
  async function removeStudent(userId: string) {
    try {
      if (import.meta.env["VITE_SUPABASE_URL"]) {
        await del({ data: { userId } });
      } else {
        const { error } = await supabase.from("profiles").delete().eq("id", userId);
        if (error) throw new Error(error.message);
      }
      setConfirmId(null);
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: ["admin-students"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2 text-sm"><span className="self-center text-muted-foreground">{rows.length} étudiants · trier par</span>
      {([["avg", "Moyenne"], ["exams", "Examens"], ["xp", "XP"]] as const).map(([k, l]) => <Button key={k} size="sm" variant={sort === k ? "default" : "outline"} onClick={() => setSort(k)}>{l}</Button>)}</div>
    <div className="card-game divide-y">{rows.map((s, i) => (
      <div key={s.user_id} className="flex flex-wrap items-center gap-3 p-3">
        <span className="w-6 text-center font-bold text-muted-foreground">{i + 1}</span>
        <Avatar config={(s.avatar ?? {}) as AvatarConfig} size={44} />
        <div className="min-w-0 flex-1"><div className="font-medium">{s.display_name ?? "(sans nom)"}</div>
          <div className="text-xs text-muted-foreground">Moy. {s.avg_score ?? "—"}/20 · Meilleur {s.best_score ?? "—"} · {s.exams_done} examens · {s.practice_done} séries · {s.mistakes_open} erreurs · {s.xp} XP · 🔥 {s.streak}
            {s.last_active ? ` · actif ${new Date(s.last_active).toLocaleDateString("fr-DZ")}` : ""}</div></div>
        <Button size="sm" variant="outline" onClick={() => void resetHearts(s.user_id)}>Restaurer cœurs</Button>
        {confirmId === s.user_id ? (
          <div className="flex gap-1">
            <Button size="sm" variant="destructive" onClick={() => void removeStudent(s.user_id)}>Confirmer</Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmId(null)}>Annuler</Button>
          </div>
        ) : (
          <Button size="sm" variant="destructive" onClick={() => setConfirmId(s.user_id)}>Supprimer</Button>
        )}
      </div>))}</div>
  </div>;
}

const GROUPS: { k: keyof AvatarDisabled; label: string; items: string[] }[] = [
  { k: "hair", label: "Coiffures", items: OPTIONS.hair },
  { k: "hijabStyle", label: "Styles de hijab", items: OPTIONS.hijabStyle },
  { k: "outfit", label: "Tenues", items: OUTFITS.map((o) => o.name) },
  { k: "beard", label: "Barbes", items: OPTIONS.beard },
  { k: "moustache", label: "Moustaches", items: OPTIONS.moustache },
  { k: "glasses", label: "Lunettes", items: OPTIONS.glasses },
  { k: "accessory", label: "Accessoires", items: OPTIONS.accessory },
];

export function AvatarResources() {
  const qc = useQueryClient();
  const { data: disabled } = useAvatarSettings();
  async function toggle(k: keyof AvatarDisabled, i: number) {
    const cur = disabled?.[k] ?? [];
    const next = { ...(disabled ?? {}), [k]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] };
    const { error } = await supabase.from("avatar_settings").update({ disabled: next, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["avatar-settings"] });
    return undefined;
  }
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Cliquez pour activer / désactiver un élément pour tous les étudiants. Le premier élément de chaque groupe reste toujours disponible.</p>
    {GROUPS.map((g) => <div key={g.k} className="card-game p-4">
      <div className="mb-2 font-semibold">{g.label}</div>
      <div className="flex flex-wrap gap-2">{g.items.map((it, i) => {
        const off = disabled?.[g.k]?.includes(i);
        return <Button key={it} size="sm" disabled={i === 0} variant={off ? "outline" : "default"} onClick={() => void toggle(g.k, i)} className={off ? "line-through opacity-60" : ""}>{it}</Button>;
      })}</div>
    </div>)}
  </div>;
}
