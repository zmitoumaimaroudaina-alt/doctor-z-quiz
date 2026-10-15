import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { Practice } from "@/components/Practice";
import type { Question } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/course/$courseId")({
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
      <Practice questions={qs} />
    </AppShell>
  );
}
