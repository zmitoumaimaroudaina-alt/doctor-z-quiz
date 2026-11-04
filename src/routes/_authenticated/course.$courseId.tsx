import { pageMetadata } from "@/lib/metadata";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { Practice } from "@/components/Practice";
import type { Question } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/course/$courseId")({
  head: () => pageMetadata("Entraînement par cours", "QCM de médecine par cours et résultats sauvegardés."),
  component: Course,
});

function Course() {
  const { courseId } = Route.useParams();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const [{ data: c, error: cErr }, { data: qs }] = await Promise.all([
        supabase.from("courses").select("title, subjects(name)").eq("id", courseId).maybeSingle(),
        supabase.from("questions").select("*").eq("course_id", courseId).order("pos"),
      ]);

      if (cErr || !c) throw new Error("Cours introuvable");

      return { c, qs: (qs ?? []) as unknown as Question[] };
    },
  });

  if (isLoading) {
    return (
      <AppShell wide>
        <div className="p-8 text-center font-semibold">Chargement du cours… ⏳</div>
      </AppShell>
    );
  }

  if (isError || !data?.c) {
    return (
      <AppShell wide>
        <div className="p-8 text-center text-destructive">
          {(error as Error)?.message || "Impossible de charger ce cours."}
        </div>
      </AppShell>
    );
  }

  const { c, qs } = data;
  const subjectName = (c.subjects as { name: string } | null)?.name ?? "";

  return (
    <AppShell wide>
      <PageTitle title={c.title ?? ""} sub={subjectName} />
      <Practice key={courseId} questions={qs} />
      <PracticeHistory questionIds={qs.map(q => q.id)} />
    </AppShell>
  );
}

function PracticeHistory({ questionIds }: { questionIds: string[] }) {
  const { data } = useQuery({ queryKey: ["practice-history", questionIds], queryFn: async () => {
    const { data, error } = await supabase.from("practice_attempts").select("id,question_ids,submitted_at,score20,correct_count,wrong_count,unanswered_count").not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(100);
    if (error) throw error;
    return (data ?? []).filter(a => a.question_ids.length === questionIds.length && a.question_ids.every((id, i) => id === questionIds[i]));
  }, refetchInterval: 5000 });
  return <section className="mt-8 border-t py-4"><h2 className="font-display text-lg font-bold">Mes tentatives enregistrées</h2>
    {data?.map(a => <div key={a.id} className="flex flex-wrap justify-between gap-2 border-b py-3 text-sm"><span>{new Date(a.submitted_at ?? "").toLocaleString("fr-DZ")}</span><strong>{Number(a.score20).toFixed(2)}/20</strong><span>✓ {a.correct_count} · ✕ {a.wrong_count} · Sans réponse {a.unanswered_count}</span></div>)}
  </section>;
}
