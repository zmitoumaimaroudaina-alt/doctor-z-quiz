import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { useExams, useSubjects } from "@/lib/queries";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/examens")({
  head: () => ({ meta: [{ title: "QCM Examens — Z QCM GAME" }, { name: "description", content: "Examens officiels par matière et par année." }] }),
  component: Examens,
});

function Examens() {
  const { data: subjects } = useSubjects();
  const { data: exams } = useExams();
  const [sel, setSel] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const subj = subjects?.find((s) => s.id === sel);
  const inSubj = (exams ?? []).filter((e) => e.exam_subjects.some((x) => x.subject_id === sel));
  const years = [...new Set(inSubj.map((e) => e.year))].sort((a, b) => b - a);

  return (
    <AppShell>
      <PageTitle title="📝 QCM Examens" ar="امتحانات" sub="Questions de la Faculté de Médecine de l’Université de Blida" />
      <Crumbs items={["Matière", subj?.name, year?.toString()]} onBack={(i) => { if (i === 0) { setSel(null); setYear(null); } if (i === 1) setYear(null); }} />
      {!subj && (
        <div className="grid gap-3 sm:grid-cols-2">
          {subjects?.map((s) => {
            const n = (exams ?? []).filter((e) => e.exam_subjects.some((x) => x.subject_id === s.id)).length;
            return (
              <button key={s.id} onClick={() => { play("click"); setSel(s.id); }} className="card-game flex items-center gap-3 p-4 text-left hover:shadow-pop">
                <span className="text-3xl">{s.emoji}</span>
                <span className="flex-1"><span className="block font-semibold">{s.name}</span><span className="ar text-xs text-muted-foreground">{s.name_ar}</span></span>
                <span className="text-xs text-muted-foreground">{n} examen{n > 1 ? "s" : ""}</span>
              </button>
            );
          })}
        </div>
      )}
      {subj && !year && (
        years.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {years.map((y) => <button key={y} onClick={() => { play("click"); setYear(y); }} className="card-game p-5 font-display text-2xl font-bold hover:shadow-pop">{y}</button>)}
          </div>
        ) : <Empty text="Aucun examen disponible pour cette matière." />
      )}
      {subj && year && (
        <div className="space-y-3">
          {inSubj.filter((e) => e.year === year).map((e) => (
            <Link key={e.id} to="/exam/$examId" params={{ examId: e.id }} className="card-game flex items-center justify-between p-4 hover:shadow-pop">
              <span><span className="block font-semibold">{e.title}</span></span>
              <span className="text-primary">Ouvrir →</span>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}

export function Crumbs({ items, onBack }: { items: (string | undefined)[]; onBack: (i: number) => void }) {
  const shown = items.filter(Boolean) as string[];
  if (shown.length < 2) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      {shown.map((t, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-muted-foreground">›</span>}
          {i < shown.length - 1 ? <button onClick={() => onBack(i)} className="text-primary hover:underline">{t}</button> : <span className="font-semibold">{t}</span>}
        </span>
      ))}
    </div>
  );
}
export const Empty = ({ text }: { text: string }) => <div className="card-game p-8 text-center text-muted-foreground">{text}</div>;