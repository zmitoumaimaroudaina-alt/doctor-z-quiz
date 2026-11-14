import { pageMetadata } from "@/lib/metadata";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { useState } from "react";
import { Practice } from "@/components/Practice";
import { Button } from "@/components/ui/button";
import type { Question } from "@/lib/queries";
import { AiExplain } from "@/components/AiExplain";
import { evaluateQuestionAnswer, getBundledExam, getBundledKey } from "@/lib/medicalData";
import { getKeyOverride, getQuestionOverride } from "@/lib/questionOverrides";

export const Route = createFileRoute("/_authenticated/erreurs/$attemptId")({
  head: () => pageMetadata("Correction de ma tentative", "Questions fausses et sans réponse de ta tentative."),
  component: Erreurs,
});

function Erreurs() {
  const { attemptId } = Route.useParams();
  const [retry, setRetry] = useState(false);
  const { data } = useQuery({
    queryKey: ["review", attemptId],
    queryFn: async () => {
      if (!attemptId.startsWith("local_exam_")) {
        try {
          const { data: remote } = await supabase.rpc("attempt_review", { _attempt: attemptId });
          if (remote && remote.length > 0) {
            return remote.map((row) => {
              const qOv = getQuestionOverride(row.question_id);
              const kOv = getKeyOverride(row.question_id);
              const official = kOv?.correct ?? row.official ?? [];
              const sel = (row.selected as string[] | null) ?? [];
              const sortedSel = [...sel].map((s) => s.toUpperCase()).sort().join(",");
              const sortedOff = [...official].map((s) => s.toUpperCase()).sort().join(",");
              return {
                ...row,
                stem: qOv?.stem ?? row.stem,
                case_text: qOv?.case_text !== undefined ? qOv.case_text : row.case_text,
                options: qOv?.options ?? row.options,
                official,
                explanation: kOv?.explanation !== undefined ? kOv.explanation : row.explanation,
                note: kOv?.note !== undefined ? kOv.note : row.note,
                ok: kOv ? sortedSel.length > 0 && sortedSel === sortedOff : row.ok,
              };
            });
          }
        } catch {
          // fallback below
        }
      }

      const attemptStr = localStorage.getItem(`attempt_${attemptId}`);
      const resStr = localStorage.getItem(`result_${attemptId}`);
      const attemptObj = attemptStr ? JSON.parse(attemptStr) : null;
      const resObj = resStr ? JSON.parse(resStr) : null;
      const examId = attemptObj?.exam_id || resObj?.exam_id;
      if (!examId) return [];

      const bundled = getBundledExam(examId);
      const ansMap: Record<string, string[]> = attemptObj?.answers || {};

      return bundled.questions.map((q) => {
        const selected = ansMap[q.id] ?? [];
        const ev = selected.length ? evaluateQuestionAnswer(q.id, selected) : null;
        const key = getBundledKey(q.id);
        return {
          question_id: q.id,
          pos: q.pos,
          case_text: q.case_text,
          stem: q.stem,
          options: q.options,
          selected,
          official: key.correct,
          explanation: key.explanation,
          note: key.note,
          ok: ev ? ev.correct : false,
          source_file: q.source_file,
          source_page: q.source_page,
        };
      });
    },
  });

  const wrong = (data ?? []).filter((r) => !r.ok);
  return (
    <AppShell>
      <PageTitle title="❌ Mes erreurs" ar="أخطائي" sub={`${wrong.length} question(s) fausse(s) ou sans réponse`} />
      {wrong.length > 0 && (
        <Button onClick={() => setRetry(!retry)} className="mb-4">
          {retry ? "Voir la correction" : "Rejouer mes erreurs"}
        </Button>
      )}
      {retry ? (
        <Practice
          questions={
            wrong.map((r) => ({
              ...r,
              id: r.question_id,
              needs_review: false,
              source_year: null,
              exam_id: null,
              course_id: null,
            })) as unknown as Question[]
          }
        />
      ) : (
        <div className="space-y-4">
          {wrong.map((r) => {
            const sel = (r.selected as string[]) ?? [];
            return (
              <div key={r.question_id} className="card-game p-5">
                {r.case_text && (
                  <div className="mb-3 whitespace-pre-line rounded-xl bg-secondary p-3 text-sm">
                    <b>Cas clinique · </b>
                    {r.case_text}
                  </div>
                )}
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-lg bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">Q{r.pos}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      sel.length ? "bg-destructive/15 text-destructive" : "bg-muted"
                    }`}
                  >
                    {sel.length ? "Fausse" : "Sans réponse"}
                  </span>
                </div>
                <p className="whitespace-pre-line font-medium">{r.stem}</p>
                <div className="mt-3 space-y-1.5">
                  {(r.options as { key: string; text: string }[]).map((o) => {
                    const ok = r.official?.includes(o.key);
                    const mine = sel.includes(o.key);
                    return (
                      <div
                        key={o.key}
                        className={`rounded-lg border p-2 text-sm ${
                          ok ? "border-success bg-success/10" : mine ? "border-destructive bg-destructive/10" : ""
                        }`}
                      >
                        <b>{o.key}.</b> {o.text} {ok && "✅"} {mine && !ok && "❌"}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-muted p-2">
                    Ta réponse : <b>{sel.join(", ") || "—"}</b>
                  </div>
                  <div className="rounded-lg bg-success/10 p-2">
                    Réponse officielle : <b>{r.official?.join(", ") || "non disponible dans la source"}</b>
                  </div>
                </div>
                <p className="ar mt-3 font-semibold text-warning-foreground">⚠️ ركز! راجع درسك مليح.</p>
                {r.explanation && (
                  <p className="mt-2 whitespace-pre-line rounded-lg bg-secondary p-2 text-sm">
                    <b>Explication officielle :</b> {r.explanation}
                  </p>
                )}
                {r.note && <p className="ar mt-2 rounded-lg bg-warning/20 p-2 text-sm">📝 ملاحظة: {r.note}</p>}
                <p className="mt-2 text-[11px] text-muted-foreground">Questions de la Faculté de Médecine de l’Université de Blida</p>
                <AiExplain
                  questionId={r.question_id}
                  selected={sel}
                  question={{
                    id: r.question_id,
                    stem: r.stem || "Question d'examen",
                    case_text: r.case_text || null,
                    options: r.options || [],
                    pos: r.pos || 1,
                  }}
                  official={{
                    correct: r.official || [],
                    explanation: r.explanation || "",
                    note: r.note || null,
                  }}
                />
              </div>
            );
          })}
          {data && !wrong.length && <div className="card-game p-8 text-center">Aucune erreur 🎉</div>}
        </div>
      )}
      <Link to="/examens" className="mt-6 inline-block text-primary">
        ← Retour aux examens
      </Link>
    </AppShell>
  );
}
