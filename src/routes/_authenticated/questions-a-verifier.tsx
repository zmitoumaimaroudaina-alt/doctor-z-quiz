import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageTitle } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { pageMetadata } from "@/lib/metadata";

export const Route = createFileRoute("/_authenticated/questions-a-verifier")({
  head: () => pageMetadata("Questions à vérifier", "Questions de médecine de Blida dont le texte, les options ou la correction nécessitent une vérification."),
  component: ReviewQuestions,
});
function ReviewQuestions() {
  const { data, error } = useQuery({ queryKey: ["flagged-questions"], queryFn: async () => {
    const { data, error } = await supabase.from("questions").select("id,pos,stem,review_reason,courses(title,subjects(name)),exams(title,year)").eq("needs_review", true).order("course_id").order("pos");
    if (error) throw error;
    return data ?? [];
  } });
  return <AppShell wide>
    <PageTitle title="Questions à vérifier" ar="أسئلة تحتاج مراجعة" sub={`${data?.length ?? "…"} questions · Faculté de Médecine de l’Université de Blida`} />
    {error && <p className="text-destructive">Impossible de charger les questions.</p>}
    <div className="divide-y border-y">
      {data?.map(q => <article key={q.id} className="space-y-2 py-5">
        <h2 className="font-semibold">{q.courses?.subjects?.name} · {q.courses?.title ?? q.exams?.title} · Q{q.pos}</h2>
        <p className="whitespace-pre-line text-sm">{q.stem || "Énoncé manquant"}</p>
        <p className="text-sm text-warning-foreground">⚠ {q.review_reason ?? "Correction à vérifier"}</p>
        <p className="text-xs text-muted-foreground">Référence : {q.id.slice(0, 8)}</p>
      </article>)}
    </div>
  </AppShell>;
}