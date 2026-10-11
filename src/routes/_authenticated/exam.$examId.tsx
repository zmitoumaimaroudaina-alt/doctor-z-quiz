import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { rpcError } from "@/lib/game";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/exam/$examId")({
  head: () => ({ meta: [{ title: "Examen — Z QCM GAME" }, { name: "description", content: "Prépare-toi à lancer l'examen." }] }),
  component: ExamIntro,
});

function ExamIntro() {
  const { examId } = Route.useParams();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["exam-intro", examId],
    queryFn: async () => {
      const [{ data: exam }, { count }, { data: st }] = await Promise.all([
        supabase.from("exams").select("*").eq("id", examId).single(),
        supabase.from("questions").select("id", { count: "exact", head: true }).eq("exam_id", examId),
        supabase.rpc("exam_status", { _exam: examId }),
      ]);
      return { exam, count: count ?? 0, st: st?.[0] };
    },
  });
  if (!data?.exam) return <AppShell><p>…</p></AppShell>;
  const { exam, st } = data;
  const locked = !st?.unlimited && ((st?.hearts_left ?? 0) <= 0 || (st?.locked_until && new Date(st.locked_until) > new Date()));

  async function start() {
    setBusy(true);
    const { data: id, error } = await supabase.rpc("start_attempt", { _exam: examId });
    setBusy(false);
    if (error) return toast.error(rpcError(error));
    play("submit");
    nav({ to: "/play/$attemptId", params: { attemptId: id as string } });
  }

  return (
    <AppShell>
      <PageTitle title={exam.title} sub={`Source : ${exam.source_file}`} />
      <div className="card-game space-y-4 p-6">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Questions" value={String(data.count)} />
          <Stat label="Durée" value="30:00" />
          <Stat label="Cœurs" value={st?.unlimited ? "∞" : "❤️".repeat(st?.hearts_left ?? 0) + "🤍".repeat(2 - (st?.hearts_left ?? 0))} />
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Réponds dans l'ordre que tu veux, saute et reviens, modifie tes réponses.</li>
          <li>Soumission automatique à 00:00.</li>
          <li>Chaque tentative terminée consomme un cœur ❤️. Après 2 tentatives, cet examen est verrouillé 24 h.</li>
        </ul>
        {locked ? (
          <div className="rounded-xl bg-destructive/10 p-4 text-center text-sm font-medium text-destructive">
            🔒 Verrouillé jusqu'à {st?.locked_until ? new Date(st.locked_until).toLocaleString("fr-DZ") : "—"}
          </div>
        ) : (
          <button disabled={busy} onClick={start} className="w-full rounded-xl bg-hero py-3 text-lg font-semibold text-primary-foreground shadow-pop">
            {busy ? "…" : "Commencer l'examen · ابدأ"}
          </button>
        )}
      </div>
    </AppShell>
  );
}
const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-primary-soft p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="font-display text-xl font-bold">{value}</div></div>
);
