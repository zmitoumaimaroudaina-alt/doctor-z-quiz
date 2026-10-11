import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { useMe } from "@/hooks/useMe";
import { fmtTime } from "@/lib/game";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/results/$attemptId")({
  head: () => ({ meta: [{ title: "Résultats — Z QCM GAME" }, { name: "description", content: "Résultats de ton examen." }] }),
  component: Results,
});

function Results() {
  const { attemptId } = Route.useParams();
  const { data: me } = useMe();
  const { data } = useQuery({
    queryKey: ["results", attemptId],
    queryFn: async () => {
      const { data: a } = await supabase.from("attempts").select("*").eq("id", attemptId).single();
      const [{ data: lb }, { data: prev }, { data: exam }] = await Promise.all([
        supabase.rpc("leaderboard", { _exam: a!.exam_id! }),
        supabase.from("attempts").select("score20").eq("exam_id", a!.exam_id!).eq("user_id", a!.user_id).not("submitted_at", "is", null).neq("id", attemptId),
        supabase.from("exams").select("title").eq("id", a!.exam_id!).single(),
      ]);
      return { a: a!, lb: lb ?? [], prevBest: Math.max(0, ...(prev ?? []).map((p) => Number(p.score20))), hadPrev: !!prev?.length, exam };
    },
  });
  useEffect(() => { if (data) play(data.hadPrev && Number(data.a.score20) > data.prevBest ? "best" : "reveal"); }, [data]);
  if (!data || !me) return <AppShell><p>…</p></AppShell>;
  const { a, lb } = data;
  const score = Number(a.score20);
  const pass = score >= 10;
  const mine = lb.find((r) => r.user_id === me.id);
  const best = Math.max(score, data.prevBest);

  return (
    <AppShell>
      <div className="card-game overflow-hidden animate-pop">
        <div className={`flex flex-col items-center gap-2 p-6 text-center ${pass ? "bg-success/10" : "bg-destructive/10"}`}>
          <Avatar config={me.avatar} mood={pass ? (score >= 15 ? "veryHappy" : "happy") : score < 6 ? "angry" : "sad"} pet={me.pet} size={120} />
          <div className="text-sm text-muted-foreground">{data.exam?.title}</div>
          <div className="font-display text-6xl font-bold">{score.toFixed(2)}<span className="text-2xl text-muted-foreground">/20</span></div>
          <div className={`rounded-full px-4 py-1 font-semibold ${pass ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}>{pass ? "Admis ✅" : "Ajourné ❌"}</div>
          {data.hadPrev && score > data.prevBest && <div className="font-semibold text-primary">🎉 Nouveau record personnel !</div>}
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-5">
          <S l="Pourcentage" v={`${Math.round((score / 20) * 100)}%`} />
          <S l="Correctes" v={`✅ ${a.correct_count}`} />
          <S l="Fausses" v={`❌ ${a.wrong_count}`} />
          <S l="Sans réponse" v={`⏭ ${a.unanswered_count}`} />
          <S l="Temps" v={fmtTime(a.duration_sec ?? 0)} />
          <S l="Tentative" v={`#${a.attempt_number}`} />
          <S l="Meilleur score" v={best.toFixed(2)} />
          <S l="Rang" v={mine ? `#${mine.rnk} / ${lb.length}` : "—"} />
        </div>
        <div className="flex flex-col gap-3 p-5 pt-0 sm:flex-row">
          <Link to="/exam/$examId" params={{ examId: a.exam_id! }} className="flex-1 rounded-xl border py-3 text-center font-semibold">🔄 Refaire l'examen</Link>
          <Link to="/erreurs/$attemptId" params={{ attemptId }} className="flex-1 rounded-xl bg-hero py-3 text-center font-semibold text-primary-foreground">❌ Voir mes erreurs</Link>
        </div>
      </div>
    </AppShell>
  );
}
const S = ({ l, v }: { l: string; v: string }) => <div className="rounded-xl bg-muted p-3 text-center"><div className="text-[11px] text-muted-foreground">{l}</div><div className="font-display text-lg font-bold">{v}</div></div>;
