import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { AiExplain } from "@/components/AiExplain";

export const Route = createFileRoute("/_authenticated/erreurs/$attemptId")({
  head: () => ({ meta: [{ title: "Mes erreurs — Z QCM GAME" }, { name: "description", content: "Correction des questions fausses et sans réponse." }] }),
  component: Erreurs,
});

function Erreurs() {
  const { attemptId } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["review", attemptId],
    queryFn: async () => (await supabase.rpc("attempt_review", { _attempt: attemptId })).data ?? [],
  });
  const wrong = (data ?? []).filter((r) => !r.ok);
  return (
    <AppShell>
      <PageTitle title="❌ Mes erreurs" ar="أخطائي" sub={`${wrong.length} question(s) fausse(s) ou sans réponse`} />
      <div className="space-y-4">
        {wrong.map((r) => {
          const sel = (r.selected as string[]) ?? [];
          return (
            <div key={r.question_id} className="card-game p-5">
              {r.case_text && <div className="mb-3 whitespace-pre-line rounded-xl bg-secondary p-3 text-sm"><b>Cas clinique · </b>{r.case_text}</div>}
              <div className="mb-2 flex items-center gap-2"><span className="rounded-lg bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">Q{r.pos}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sel.length ? "bg-destructive/15 text-destructive" : "bg-muted"}`}>{sel.length ? "Fausse" : "Sans réponse"}</span></div>
              <p className="whitespace-pre-line font-medium">{r.stem}</p>
              <div className="mt-3 space-y-1.5">
                {(r.options as { key: string; text: string }[]).map((o) => {
                  const ok = r.official?.includes(o.key); const mine = sel.includes(o.key);
                  return <div key={o.key} className={`rounded-lg border p-2 text-sm ${ok ? "border-success bg-success/10" : mine ? "border-destructive bg-destructive/10" : ""}`}><b>{o.key}.</b> {o.text} {ok && "✅"} {mine && !ok && "❌"}</div>;
                })}
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-muted p-2">Ta réponse : <b>{sel.join(", ") || "—"}</b></div>
                <div className="rounded-lg bg-success/10 p-2">Réponse officielle : <b>{r.official?.join(", ") || "non disponible dans la source"}</b></div>
              </div>
              <p className="ar mt-3 font-semibold text-warning-foreground">⚠️ ركز! راجع درسك مليح.</p>
              {r.explanation && <p className="mt-2 whitespace-pre-line rounded-lg bg-secondary p-2 text-sm"><b>Explication officielle :</b> {r.explanation}</p>}
              {r.note && <p className="ar mt-2 rounded-lg bg-warning/20 p-2 text-sm">📝 ملاحظة: {r.note}</p>}
              <p className="mt-2 text-[11px] text-muted-foreground">Source : {r.source_file}{r.source_page ? ` · p.${r.source_page}` : ""}</p>
              <AiExplain questionId={r.question_id} selected={sel} />
            </div>
          );
        })}
        {data && !wrong.length && <div className="card-game p-8 text-center">Aucune erreur 🎉</div>}
      </div>
      <Link to="/examens" className="mt-6 inline-block text-primary">← Retour aux examens</Link>
    </AppShell>
  );
}
