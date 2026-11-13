import { pageMetadata } from "@/lib/metadata";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { useSubjects } from "@/lib/queries";
import { Crumbs, Empty } from "./examens";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/cours")({
  head: () => pageMetadata("QCM par Cours", "Questions de la Faculté de Médecine de l’Université de Blida par cours."),
  component: Cours,
});

function Cours() {
  const { data: subjects } = useSubjects();
  const [sel, setSel] = useState<number | null>(null);
  const { data } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { getBundledCourses } = await import("@/lib/medicalData");
      const bundled = getBundledCourses();
      try {
        const [{ data: c }, { data: n }] = await Promise.all([
          supabase.from("courses").select("*").order("sort"),
          supabase.rpc("my_course_counts"),
        ]);
        if (c && c.length > 0) {
          const counts = new Map((n ?? []).map((x) => [x.course_id, Number(x.n)]));
          const remote = (c ?? []).map((x) => ({ ...x, n: counts.get(x.id) ?? 0 }));
          const remoteIds = new Set(remote.map((r) => r.id));
          return [...bundled.filter((b) => b.id.startsWith("course-uei1-2025") || !remoteIds.has(b.id)), ...remote];
        }
      } catch {
        // use fallback
      }
      return bundled;
    },
  });
  const subj = subjects?.find((s) => s.id === sel);
  const list = (data ?? []).filter((c) => c.subject_id === sel);
  return (
    <AppShell>
      <PageTitle title="📚 QCM par Cours" ar="حسب الدروس" sub="Questions de la Faculté de Médecine de l’Université de Blida" />
      <Crumbs items={["Matière", subj?.name]} onBack={() => setSel(null)} />
      {!subj ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {subjects?.map((s) => {
            const n = (data ?? []).filter((c) => c.subject_id === s.id).length;
            return (
              <button key={s.id} onClick={() => { play("click"); setSel(s.id); }} className="card-game flex items-center gap-3 p-4 text-left hover:shadow-pop">
                <span className="text-3xl">{s.emoji}</span>
                <span className="flex-1"><span className="block font-semibold">{s.name}</span><span className="ar text-xs text-muted-foreground">{s.name_ar}</span></span>
                <span className="text-xs text-muted-foreground">{n} cours</span>
              </button>
            );
          })}
        </div>
      ) : list.length ? (
        <div className="space-y-2">
          {list.map((c, i) => (
            <Link key={c.id} to="/course/$courseId" params={{ courseId: c.id }} className="card-game flex items-center gap-3 p-4 hover:shadow-pop">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft font-bold text-primary">{i + 1}</span>
              <span className="flex-1"><span className="block font-semibold">{c.title}</span><span className="text-xs text-muted-foreground">{c.n} QCM</span></span>
              <span className="text-primary">→</span>
            </Link>
          ))}
        </div>
      ) : <Empty text="Aucun cours disponible pour cette matière." />}
    </AppShell>
  );
}