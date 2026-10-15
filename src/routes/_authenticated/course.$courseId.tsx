import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { Practice } from "@/components/Practice";
import type { Question } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/course/$courseId")({
  head: () => ({ meta: [{ title: "Cours — Z QCM GAME" }, { name: "description", content: "QCM du cours." }] }),
  component: Course,
});

function Course() {
  const { courseId } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const [{ data: c }, { data: qs }] = await Promise.all([
        supabase.from("courses").select("title, subjects(name)").eq("id", courseId).single(),
        supabase.from("questions").select("*").eq("course_id", courseId).order("pos"),
      ]);
      return { c, qs: (qs ?? []) as unknown as Question[] };
    },
  });
  return (
    <AppShell wide>
      {data && <>
        <PageTitle title={data.c?.title ?? ""} sub={(data.c?.subjects as { name: string } | null)?.name ?? ""} />
        <Practice questions={data.qs} />
      </>}
    </AppShell>
  );
}