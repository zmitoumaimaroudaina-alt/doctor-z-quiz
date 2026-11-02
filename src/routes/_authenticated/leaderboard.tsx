import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { Avatar, type AvatarConfig } from "@/components/Avatar";
import { useMe } from "@/hooks/useMe";
import { useExams } from "@/lib/queries";
import { fmtTime, rpcError } from "@/lib/game";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — Z QCM GAME" }, { name: "description", content: "Classement en direct par examen." }] }),
  component: Leaderboard,
});

function Leaderboard() {
  const { data: me } = useMe();
  const { data: exams } = useExams();
  const [examId, setExamId] = useState<string>("");
  const [flying, setFlying] = useState<string | null>(null);
  const qc = useQueryClient();
  const id = examId || exams?.[0]?.id || "";

  const { data: rows } = useQuery({
    queryKey: ["lb", id],
    enabled: !!id,
    queryFn: async () => (await supabase.rpc("leaderboard", { _exam: id })).data ?? [],
  });
  const { data: creators } = useQuery({ queryKey: ["creators"], queryFn: async () => new Set(((await supabase.rpc("creator_ids")).data ?? []) as string[]) });

  useEffect(() => {
    if (!id || !me) return;
    const ch = supabase.channel(`lb-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attempts", filter: `exam_id=eq.${id}` }, () => qc.invalidateQueries({ queryKey: ["lb", id] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tomatoes" }, (p) => {
        const t = p.new as { target_id: string; thrower_id: string };
        qc.invalidateQueries({ queryKey: ["lb", id] });
        if (t.target_id === me.id) {
          play("hit");
          toast(creators?.has(t.thrower_id) ? "🍅 Doctor Z ضربك بالطماطم! شكون شريك؟ 😂" : "🍅 Tu as reçu une tomate !");
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [id, me, qc, creators]);

  const mine = rows?.find((r) => r.user_id === me?.id);
  const canThrow = !!me && (me.isCreator || (!!mine && mine.rnk <= 5));

  async function throwAt(target: string) {
    play("throw");
    setFlying(target);
    const { error } = await supabase.rpc("throw_tomato", { _exam: id, _target: target });
    setTimeout(() => setFlying(null), 700);
    if (error) { toast.error(rpcError(error)); return; }
    setTimeout(() => play("hit"), 500);
    toast.success("🍅 Splash !");
  }
  async function saveBubble(text: string) {
    if (!me) return;
    const clean = text.replace(/[<>]/g, "").slice(0, 60);
    const { error } = await supabase.from("profiles").update({ bubble: clean }).eq("id", me.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["lb", id] });
  }

  const top5 = (rows ?? []).slice(0, 5);
  return (
    <AppShell wide>
      <PageTitle title="🏆 Leaderboard" ar="الترتيب" sub="Un classement par examen exact. Meilleur score, puis temps le plus rapide." />
      <select value={id} onChange={(e) => setExamId(e.target.value)} className="mb-5 w-full rounded-xl border bg-card px-3 py-2.5 sm:w-auto">
        {exams?.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
      </select>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {top5.map((r) => (
          <div key={r.user_id} className={`card-game relative flex flex-col items-center p-3 text-center ${r.rnk === 1 ? "ring-2 ring-gold" : ""}`}>
            {r.bubble && <div className="mb-1 max-w-full truncate rounded-xl bg-primary-soft px-2 py-1 text-[11px]">💬 {r.bubble}</div>}
            <div className="relative">
              <Avatar config={r.avatar as AvatarConfig} pet={r.pet} size={90} tomato={!!r.tomato_until} mood={r.rnk === 1 ? "veryHappy" : "happy"} />
              {flying === r.user_id && <span className="animate-tomato absolute left-1/3 top-1/4 text-3xl">🍅</span>}
            </div>
            <div className="mt-1 text-lg">{["🥇", "🥈", "🥉", "4️⃣", "5️⃣"][Number(r.rnk) - 1] ?? `#${r.rnk}`}</div>
            <div className="w-full truncate font-semibold">{r.display_name}</div>
            <div className="text-sm"><b>{Number(r.best_score).toFixed(2)}</b>/20 · {fmtTime(r.best_time ?? 0)}</div>
            {canThrow && r.user_id !== me?.id && <button onClick={() => throwAt(r.user_id)} className="mt-2 rounded-lg bg-tomato/15 px-2 py-1 text-xs font-semibold text-tomato">🍅 Lancer</button>}
          </div>
        ))}
        {!top5.length && <div className="col-span-full card-game p-8 text-center text-muted-foreground">Personne n'a encore passé cet examen.</div>}
      </div>

      {mine && <BubbleEditor initial={mine.bubble ?? ""} onSave={saveBubble} />}

      {(rows?.length ?? 0) > 5 && (
        <div className="card-game mt-6 divide-y">
          {rows!.slice(5).map((r) => (
            <div key={r.user_id} className="flex items-center gap-3 p-3">
              <span className="w-8 text-center font-bold">#{r.rnk}</span>
              <Avatar config={r.avatar as AvatarConfig} size={36} tomato={!!r.tomato_until} />
              <span className="flex-1 truncate">{r.display_name}</span>
              <span className="text-sm">{Number(r.best_score).toFixed(2)} · {fmtTime(r.best_time ?? 0)}</span>
              {canThrow && r.user_id !== me?.id && <button onClick={() => throwAt(r.user_id)} aria-label="Lancer une tomate">🍅</button>}
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">Les tomates sont purement cosmétiques (24 h) et n'affectent jamais score, rang, cœurs, XP ou pièces. Cooldown : 10 min.</p>
    </AppShell>
  );
}

const PRESETS = ["Yallah! 💪", "Wech, rani hna 😎", "Révise bien!", "QCM master 🧠", "Doctor en devenir 🩺"];
function BubbleEditor({ initial, onSave }: { initial: string; onSave: (t: string) => void }) {
  const [t, setT] = useState(initial);
  return (
    <div className="card-game mt-4 p-4">
      <div className="mb-2 text-sm font-semibold">💬 Ma bulle (60 caractères max)</div>
      <div className="mb-2 flex flex-wrap gap-1.5">{PRESETS.map((p) => <button key={p} onClick={() => { setT(p); onSave(p); }} className="rounded-full border px-2.5 py-1 text-xs">{p}</button>)}</div>
      <div className="flex gap-2"><input value={t} maxLength={60} onChange={(e) => setT(e.target.value)} className="flex-1 rounded-lg border px-3 py-2 text-sm" /><button onClick={() => onSave(t)} className="rounded-lg bg-primary px-3 text-sm text-primary-foreground">OK</button></div>
    </div>
  );
}
