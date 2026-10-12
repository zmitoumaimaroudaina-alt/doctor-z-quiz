import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { useMe } from "@/hooks/useMe";
import { deleteStudent } from "@/lib/account.functions";
import type { Option } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Panneau Creator — Z QCM GAME" }, { name: "description", content: "Gestion du contenu et des étudiants." }] }),
  component: Admin,
});

function Admin() {
  const { data: me } = useMe();
  const [tab, setTab] = useState<"review" | "search" | "students">("review");
  if (!me) return null;
  if (!me.isCreator) return <AppShell><p>Accès réservé au Creator.</p></AppShell>;
  return (
    <AppShell wide>
      <PageTitle title="👑 Panneau Creator" sub="Toutes les actions sont vérifiées côté serveur." />
      <div className="mb-4 flex gap-2">
        {([["review", "À vérifier"], ["search", "Questions"], ["students", "Étudiants"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? "bg-primary text-primary-foreground" : "border bg-card"}`}>{l}</button>
        ))}
      </div>
      {tab === "students" ? <Students /> : <Questions reviewOnly={tab === "review"} />}
    </AppShell>
  );
}

function Questions({ reviewOnly }: { reviewOnly: boolean }) {
  const [q, setQ] = useState("");
  const { data, refetch } = useQuery({
    queryKey: ["admin-q", reviewOnly, q],
    queryFn: async () => {
      let s = supabase.from("questions").select("*, question_keys(*)").order("source_file").order("pos").limit(50);
      if (reviewOnly) s = s.eq("needs_review", true);
      if (q.trim()) s = s.ilike("stem", `%${q.trim()}%`);
      return (await s).data ?? [];
    },
  });
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans l'énoncé…" className="mb-4 w-full rounded-xl border px-3 py-2" />
      <div className="space-y-3">{data?.map((row) => <Editor key={row.id} row={row} onSaved={() => refetch()} />)}</div>
      {data && !data.length && <p className="text-muted-foreground">Rien à afficher.</p>}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Editor({ row, onSaved }: { row: any; onSaved: () => void }) {
  const key = Array.isArray(row.question_keys) ? row.question_keys[0] : row.question_keys;
  const [open, setOpen] = useState(false);
  const [stem, setStem] = useState<string>(row.stem);
  const [opts, setOpts] = useState<Option[]>(row.options);
  const [correct, setCorrect] = useState<string>((key?.correct ?? []).join(""));
  const [expl, setExpl] = useState<string>(key?.explanation ?? "");
  const [note, setNote] = useState<string>(key?.note ?? "");
  async function save(clearFlag: boolean) {
    const letters = [...new Set(correct.toUpperCase().replace(/[^A-E]/g, "").split(""))].sort();
    const r1 = await supabase.from("questions").update({ stem, options: opts, ...(clearFlag ? { needs_review: false, review_reason: null } : {}) }).eq("id", row.id);
    const r2 = await supabase.from("question_keys").upsert({ question_id: row.id, correct: letters, explanation: expl || null, note: note || null });
    if (r1.error || r2.error) return toast.error((r1.error ?? r2.error)!.message);
    toast.success("Question mise à jour"); onSaved();
  }
  return (
    <div className="card-game p-4">
      <button onClick={() => setOpen(!open)} className="w-full text-left">
        <div className="text-xs text-muted-foreground">{row.source_file} · p.{row.source_page} · #{row.pos} {row.needs_review && <span className="ml-1 rounded bg-warning/30 px-1">⚠ {row.review_reason}</span>}</div>
        <div className="line-clamp-2 font-medium">{row.stem}</div>
      </button>
      {open && (
        <div className="mt-3 space-y-2 text-sm">
          <textarea value={stem} onChange={(e) => setStem(e.target.value)} rows={3} className="w-full rounded-lg border p-2" />
          {opts.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input value={o.key} onChange={(e) => setOpts(opts.map((x, j) => j === i ? { ...x, key: e.target.value.toUpperCase().slice(0, 1) } : x))} className="w-10 rounded-lg border p-2 text-center" />
              <input value={o.text} onChange={(e) => setOpts(opts.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} className="flex-1 rounded-lg border p-2" />
              <button onClick={() => setOpts(opts.filter((_, j) => j !== i))} className="px-2">✕</button>
            </div>
          ))}
          <button onClick={() => setOpts([...opts, { key: "ABCDE"[opts.length] ?? "?", text: "" }])} className="text-primary">+ option</button>
          <label className="block">Réponse officielle (lettres) <input value={correct} onChange={(e) => setCorrect(e.target.value)} className="ml-2 w-24 rounded-lg border p-1.5" /></label>
          <textarea value={expl} onChange={(e) => setExpl(e.target.value)} placeholder="Explication officielle (source)" rows={2} className="w-full rounded-lg border p-2" />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (source)" rows={2} className="w-full rounded-lg border p-2" />
          <div className="flex gap-2">
            <button onClick={() => save(false)} className="rounded-lg bg-primary px-3 py-2 text-primary-foreground">Enregistrer</button>
            {row.needs_review && <button onClick={() => save(true)} className="rounded-lg bg-success px-3 py-2 text-success-foreground">Enregistrer & valider</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function Students() {
  const qc = useQueryClient();
  const del = useServerFn(deleteStudent);
  const { data } = useQuery({
    queryKey: ["admin-students"],
    queryFn: async () => (await supabase.from("profiles").select("id, display_name, xp, coins, streak, created_at").order("created_at", { ascending: false })).data ?? [],
  });
  async function resetHearts(id: string) {
    const { error } = await supabase.from("exam_hearts").delete().eq("user_id", id);
    if (error) return toast.error(error.message);
    toast.success("Cœurs restaurés ❤️❤️");
  }
  return (
    <div className="card-game divide-y">
      {data?.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-3 p-3">
          <span className="flex-1 font-medium">{s.display_name ?? "(sans nom)"}</span>
          <span className="text-xs text-muted-foreground">{s.xp} XP · 🪙 {s.coins} · 🔥 {s.streak}</span>
          <button onClick={() => resetHearts(s.id)} className="rounded-lg border px-2 py-1 text-xs">Restaurer cœurs</button>
          <button onClick={async () => { if (!confirm("Supprimer définitivement cet étudiant ?")) return; try { await del({ data: { userId: s.id } }); toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["admin-students"] }); } catch (e) { toast.error((e as Error).message); } }}
            className="rounded-lg bg-destructive/10 px-2 py-1 text-xs text-destructive">Supprimer</button>
        </div>
      ))}
    </div>
  );
}
